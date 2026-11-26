import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deployHosting,servingConfig} from '../scripts/desplegar-hosting.mjs';
import {publicarPaquetes} from '../scripts/publicar-paquetes-ciudad.mjs';
import {lists} from '../plataforma/paquete-ciudad.js';

const root='/plataforma/paquetes-ciudad/';
const cutoff=Date.parse('2026-11-11T04:00:00Z');
const manifest={A:{key:'QQ',revision:1,deltas:[]},B:{key:'Qg',revision:2,deltas:[1]}};
const complete=(city,revision)=>({city,revision,modules:Object.fromEntries(Object.entries(lists).map(([name,[field]])=>[name,{success:true,[field]:[]}]))});

test('corte de la 01:00 y despliegue de código prescinden de cuerpos publicados intactos',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'gld-hosting-reuse-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const delta={guide:{upsert:[{anunciante_id:'actualizado'}],remove:[]}};
  for(const mode of ['cut','preserve'])for(const reusePublished of [false,true]){
    const stage=join(directory,mode+String(reusePublished));
    await mkdir(join(stage,'plataforma'),{recursive:true});
    await writeFile(join(stage,'plataforma','territorio-cache.js'),'const paquetes = /* GLD_CITY_BOOKS */ {};');
    const urls=[],operations=[];
    await publicarPaquetes({mode,stage,reusePublished,cutoff:cutoff+86400000,identity:async()=>'fixture',
      observe:operation=>operations.push(operation),
      read:async (value,options)=>{
        const url=new URL(value);
        if(url.hostname.endsWith('workers.dev'))return Response.json({complete:true,after:cutoff,cutoff:cutoff+86400000,cities:[{city:'A',changes:delta}]});
        urls.push(url.pathname);
        if(url.pathname===root+'publicacion.json')return Response.json({cutoff,manifest});
        if(url.pathname===root+'QQ/completo-1.json')return Response.json(complete('A',1));
        if(!reusePublished&&url.pathname===root+'Qg/completo-2.json')return Response.json(complete('B',2));
        if(!reusePublished&&url.pathname===root+'Qg/cambios-1-2.json')return Response.json({city:'B',from:1,revision:2,changes:{}});
        assert.fail('Descarga duplicada o de ciudad sin cambios: '+url.pathname);
      }});
    if(!reusePublished)assert.equal(urls.length,4);
    else assert.deepEqual(urls,mode==='cut'?[root+'publicacion.json',root+'QQ/completo-1.json']:[root+'publicacion.json']);
    const publicOps=operations.filter(operation=>operation.service==='hosting');
    assert.equal(publicOps.length,urls.length);
    t.diagnostic(JSON.stringify({mode,reusePublished,hostingRequests:publicOps.length,
      hostingBodyBytes:publicOps.reduce((sum,operation)=>sum+operation.responseBodyBytes,0)}));
  }
});

test('Hosting conserva archivos y rutas ajenos al despacho urgente por sus hashes',async t=>{
  const stage=await mkdtemp(join(tmpdir(),'gld-hosting-api-'));t.after(()=>rm(stage,{recursive:true,force:true}));
  await mkdir(join(stage,root,'QQ'),{recursive:true});
  const old='sites/anunciantes-guialocal/versions/base',version='sites/anunciantes-guialocal/versions/nueva';
  const untouched={'/plataforma/carcasa.html':'f'.repeat(64),[root+'Qg/completo-2.json']:'e'.repeat(64),[root+'Qg/cambios-1-2.json']:'d'.repeat(64)};
  const config={cleanUrls:true,rewrites:[{glob:'/descubrir',path:'/plataforma/carcasa.html'}]};
  const index={cutoff,manifest:{...manifest,A:{...manifest.A,revision:2,deltas:[1]}}};
  for(const [path,value] of Object.entries({[root+'publicacion.json']:index,[root+'QQ/completo-2.json']:complete('A',2),[root+'QQ/cambios-1-2.json']:{city:'A',from:1,revision:2,changes:{}}})){
    await writeFile(join(stage,path),JSON.stringify(value));
  }
  const calls=[];
  let active=old, stagedFiles, etag='"base"';
  const api=async(url,options)=>{
    calls.push([url.pathname,options.method]);
    if(options.method==='HEAD')return new Response(null,{headers:{etag}});
    const json=()=>JSON.parse(options.body);
    if(options.method==='GET'&&url.pathname.endsWith('/releases'))return Response.json({releases:[{version:{name:active}}]});
    if(url.pathname.endsWith('/files'))return Response.json({files:Object.entries(active===old?untouched:stagedFiles).map(([path,hash])=>({path,hash}))});
    if(options.method==='GET'&&url.pathname.endsWith('/base'))return Response.json({config});
    if(url.pathname.endsWith('/versions')){
      assert.deepEqual(json(),{config});
      return Response.json({name:version});
    }
    if(url.pathname.endsWith(':populateFiles')){
      stagedFiles=json().files;
      for(const [path,hash] of Object.entries(untouched))assert.equal(json().files[path],hash);
      assert.equal(Object.keys(json().files).length,6);
      return Response.json({uploadRequiredHashes:[json().files[root+'publicacion.json']],uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/fixture'});
    }
    if(url.hostname==='upload-firebasehosting.googleapis.com')return new Response();
    if(options.method==='PATCH'){
      assert.deepEqual(json(),{status:'FINALIZED'});
      return Response.json({success:true});
    }
    if(options.method==='POST'&&url.pathname.endsWith('/releases')){
      active=url.searchParams.get('versionName');
      return Response.json({version:{name:active}});
    }
    assert.fail(url.href);
  };
  const steps=[];
  const options={stage,mode:'urgent',token:'fixture',read:api,baseIndex:{status:200,etag}};
  const result=await deployHosting({...options,observe:step=>steps.push(step)});
  assert.equal(result.previous,old);
  assert.equal(result.version,version);
  assert.equal(result.metrics.requests,calls.length-1);
  assert.equal(result.metrics.requestBodyBytes,steps.reduce((sum,step)=>sum+step.requestBodyBytes,0));
  assert.equal(result.metrics.responseBodyBytes,steps.reduce((sum,step)=>sum+step.responseBodyBytes,0));
  assert(result.metrics.uploadBytes>0);
  t.diagnostic(JSON.stringify(result.metrics));
  assert.equal(calls.filter(([path,method])=>path.startsWith('/upload')&&method==='POST').length,1);
  const same=await deployHosting(options);
  assert.equal(same.metrics.requests,2);
  assert.equal(same.metrics.uploadBytes,0);
  etag='"otro"';
  await assert.rejects(deployHosting(options),/Cambió el índice/);
  etag='"base"';
  await writeFile(join(stage,'plataforma','carcasa.html'),'modificación ajena');
  await assert.rejects(deployHosting(options),/ajenos/);
  assert.equal(calls.filter(([path,method])=>path.endsWith('/releases')&&method==='POST').length,1);
});

test('inspección es de sólo lectura y la reversión exige preservar los paquetes vigentes',async()=>{
  const base='sites/anunciantes-guialocal/versions/base';
  const active='sites/anunciantes-guialocal/versions/actual';
  let installed=active,olderHash='c'.repeat(64),writes=0;
  const call=async(url,options)=>{
    if(url.pathname.endsWith('/files'))return Response.json({files:[
      {path:root+'publicacion.json',hash:url.pathname.includes('/base/')?olderHash:'a'.repeat(64)},
      {path:'/plataforma/inicio.html',hash:'b'.repeat(64)},
    ]});
    if(options.method==='POST'){writes++;installed=url.searchParams.get('versionName');}
    return Response.json({releases:[{version:{name:installed}}]});
  };
  const inspection=await deployHosting({mode:'inspect',token:'fixture',read:call});
  assert.equal(inspection.metrics.requests,2);
  assert.equal(inspection.version,active);
  const options={mode:'rollback',target:base,expected:active,token:'fixture',read:call};
  await assert.rejects(deployHosting(options),/restauraría/);
  assert.equal(writes,0);
  olderHash='a'.repeat(64);
  const verification=await deployHosting({...options,mode:'rollback-check'});
  assert.equal(verification.compatible,true);
  assert.equal(verification.version,active);
  assert.equal(verification.metrics.requests,3);
  assert.equal(writes,0);
  const reverted=await deployHosting(options);
  assert.equal(reverted.version,base);
  assert.equal(reverted.metrics.uploadBytes,0);
  assert.equal(writes,1);
  await assert.rejects(deployHosting(options),/verificá cuál está activa/);
  assert.equal(writes,1);
});

test('las rutas estáticas actuales se convierten al contrato de Firebase',async()=>{
  const {hosting}=JSON.parse(await readFile('firebase.json','utf8'));
  const config=servingConfig(hosting);
  assert.deepEqual(config.rewrites.find(rule=>rule.glob==='/descubrir'),{glob:'/descubrir',path:'/plataforma/carcasa.html'});
  assert.equal(config.redirects[0].statusCode,301);
  assert.equal(typeof config.headers[0].headers['Cache-Control'],'string');
});

test('overlay conserva la configuración y los hashes ajenos al bloque',async t=>{
  const stage=await mkdtemp(join(tmpdir(),'gld-hosting-overlay-'));
  t.after(()=>rm(stage,{recursive:true,force:true}));
  const site='sites/anunciantes-guialocal',base=site+'/versions/base',candidate=site+'/versions/new';
  const path='/pie.html',keep=root+'publicacion.json',hash='a'.repeat(64),config={cleanUrls:true};
  await writeFile(join(stage,path),'pie actualizado');
  let active=base,updates=0;
  const read=async(url,{method,body})=>{
    if(method==='GET'&&url.pathname.endsWith('/releases'))return Response.json({releases:[{version:{name:active}}]});
    if(method==='GET'&&url.pathname.endsWith('/files'))return Response.json({files:[{path:keep,hash}]});
    if(method==='GET'&&url.pathname.endsWith('/base'))return Response.json({config});
    updates++;
    if(url.pathname.endsWith('/versions')){
      assert.deepEqual(JSON.parse(body),{config});
      return Response.json({name:candidate});
    }
    if(url.pathname.endsWith(':populateFiles')){
      const files=JSON.parse(body).files;
      assert.deepEqual(Object.keys(files),[keep,path]);
      assert.equal(files[keep],hash);
      return Response.json({uploadRequiredHashes:[]});
    }
    if(method==='PATCH')return Response.json({});
    if(method==='POST'&&url.pathname.endsWith('/releases')){
      active=url.searchParams.get('versionName');
      return Response.json({});
    }
    assert.fail(url.href);
  };
  const options={stage,mode:'overlay',expected:base,token:'fixture',read};
  await assert.rejects(deployHosting({...options,overlayPaths:['/otro.html']}),/alcance autorizado/);
  assert.equal(updates,0);
  assert.equal((await deployHosting({...options,overlayPaths:[path]})).version,candidate);
  const rollback=await deployHosting({mode:'rollback-check',expected:candidate,target:base,token:'fixture',read});
  assert.equal(rollback.compatible,true);
  assert.equal(active,candidate);
});
