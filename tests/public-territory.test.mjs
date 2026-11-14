import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {publicationCutoff} from '../scripts/publicar-paquetes-ciudad.mjs';
import {preparePublicTerritory} from '../scripts/prepare-public-territory.mjs';

const template=await readFile(new URL('../plataforma/territorio-cache.js',import.meta.url),'utf8');
const publication={build:'207-arranque-recuperable-2',cutoff:publicationCutoff(),status:'staged'};
const packet={success:true,version:1,paises:[{pais_id:'ARG'}],provincias:[{provincia_id:'BUE'}],ciudades:[{ciudad_id:'DOL',ciudad_visible:'Dolores'}]};
function browser(script,box){
 let requests=0,writes=0;
 const window={};
 runInNewContext(script,{window,AbortController,setTimeout,clearTimeout,
  fetch:async()=>{requests++;return Response.json(packet);},
  localStorage:{getItem:()=>box,setItem:(_,value)=>{writes++;box=value;}}
 });
 return {load:window.GLD_CATALOGO_TERRITORIAL.load,stats:()=>({box,writes,requests})};
}

test('usa una lista anterior válida aunque lleve años guardada',async()=>{
 const b=browser(template,JSON.stringify({ts:1,data:packet}));
 assert.equal((await b.load()).ciudades[0].ciudad_visible,'Dolores');
 assert.equal(b.stats().requests,0);
});

test('el catálogo publicado actualiza solo cuando cambia la revisión',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gld-territory-'));
 try{
  const file=join(dir,'territorio-cache.js');
  await writeFile(file,template);
  const first=await preparePublicTerritory({file,read:async()=>Response.json(packet)});
  const initial=await readFile(file,'utf8');
  const a=browser(initial);
  await a.load();
  await a.load();
  assert.deepEqual({requests:a.stats().requests,writes:a.stats().writes},{requests:0,writes:1});
  const warm=browser(initial,a.stats().box);
  await warm.load();
  assert.deepEqual({requests:warm.stats().requests,writes:warm.stats().writes},{requests:0,writes:0});

  await writeFile(file,template);
  const same=await preparePublicTerritory({file,scheduled:true,identity:async()=> 'fixture-oidc',read:async url=>
   url.endsWith('.js')?new Response(initial):Response.json({...packet,updated_at:'nuevo-sello',publication})});
  assert.deepEqual(same,{changed:false,revision:first.revision});
  assert.equal(await readFile(file,'utf8'),template);

  const changed={...packet,ciudades:[...packet.ciudades,{ciudad_id:'TAN',ciudad_visible:'Tandil'}]};
  await preparePublicTerritory({file,scheduled:true,identity:async()=> 'fixture-oidc',read:async url=>
   url.endsWith('.js')?new Response(initial):Response.json({...changed,publication})});
  const next=browser(await readFile(file,'utf8'),a.stats().box);
  assert.equal((await next.load()).ciudades[1].ciudad_visible,'Tandil');
  assert.deepEqual({requests:next.stats().requests,writes:next.stats().writes},{requests:0,writes:1});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('un Worker anterior o un corte equivocado no modifica archivos ni consulta Hosting para publicar',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'gld-territory-incompatible-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'territorio-cache.js');await writeFile(file,template);
 for(const invalid of [undefined,{...publication,build:'207'},{...publication,cutoff:publication.cutoff-86400000},{...publication,status:'pending'}]){
  let requests=0;
  await assert.rejects(preparePublicTerritory({file,scheduled:true,cutoff:publication.cutoff,identity:async()=> 'fixture',read:async url=>{
   requests++;assert(String(url).endsWith('/internal/city-books'));return Response.json({...packet,publication:invalid});
  }}),/no confirmó/);
  assert.equal(requests,1);assert.equal(await readFile(file,'utf8'),template);
 }
});
