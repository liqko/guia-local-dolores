import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac} from 'node:crypto';
import worker,{GldPublicCache119} from './worker-instrumentado.mjs';
import fs from 'node:fs';
import {sqliteNamespace} from './sqlite-namespace.mjs';
const rows=new Map(),values=new Map(),calls=[],allOperations=[];let revision=0;
const nativePush=calls.push.bind(calls);calls.push=(...entries)=>{allOperations.push(...entries);return nativePush(...entries);};
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SERVER_SECRET:'test-only',FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@test.invalid',FIREBASE_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),GLD_CACHE_KV:{async get(k){return values.get(k)??null},async put(k,v){values.set(k,v)},async delete(k){values.delete(k)},async list({prefix}){return {keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}}};
function seed(c,id,data){rows.set(c+'/'+id,{id,...data});}
function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(v)};return {stringValue:String(v)};}
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,v])=>[k,decode(v)]));if('arrayValue'in v)return v.arrayValue.values.map(decode);if('nullValue'in v)return null;return v.stringValue??v.booleanValue??Number(v.integerValue);}
function doc(c,id,data){return {updateTime:data._version||'2026-10-12T12:00:00.000000Z',name:'projects/test/databases/(default)/documents/'+c+'/'+id,fields:Object.fromEntries(Object.entries(data).filter(([k])=>k!=='id').map(([k,v])=>[k,encode(v)]))};}
seed('suscriptores','S',{mail:'persona@test.invalid',clave:'test-password',activo:true,email_verificado:true,tipo_usuario:'RESIDENTE',ciudad_origen_otro:'Córdoba'});
seed('suscriptor_anunciante','R',{suscriptor_id:'S',anunciante_id:'A',anunciante_nombre:'Comercio',rol:'PROPIETARIO',permisos:'TURNOS_FARMA,PROMOS,EVENTOS,EVENTOS_FREE,ACTIVIDADES,EFEMERIDES',activo:true});
seed('anunciantes_administracion','A',{funcionalidades:'PUBLICIDAD,FARMACIAS',turnos_farma:'*',funcionalidades_config:{PUBLICIDAD:{activas_max:3,guardadas_max:6,cambios_activos_por_dia_max:5}}});
seed('publicidades','P',{anunciante_id:'A',publicidad_id:'P',titulo:'Anuncio',estado:'INACTIVA',aprobado:true,formato:'IMAGEN'});
seed('publicidad_media','M',{publicidad_id:'P',media_id:'M',url:'imagen.jpg',tipo_media:'IMAGEN',activo:true,orden:1});
seed('publicidad_segmentacion','G',{publicidad_id:'P',segmentacion_id:'G',ciudad_id:'D',ubicacion_id:'U',categoria_id:'CAT',activo:true});
seed('anunciantes_sedes','SED',{anunciante_id:'A',ciudad_id:'D',sede_id:'SED'});
seed('farmacias_ciclos','C',{anunciante_id:'A',ciclo_id:'C',nombre:'Ciclo',ciudad_id:'D',fecha_inicio:'2026-10-07',hora_inicio:'08:00',duracion_horas:24,farmacias_por_turno:1,activo:true});
seed('farmacias_ciclo_sedes','F',{ciclo_id:'C',sede_id:'SED'});
values.set('territorio:public:v1',JSON.stringify({version:1,ciudades:[{ciudad_id:'D',ciudad_visible:'DOLORES'}]}));
values.set('catalogs:publicidad:v1',JSON.stringify({categorias:[{categoria_id:'CAT'}],ubicaciones:[{ubicacion_id:'U',modulo:'GUIA'}]}));
values.set('farmacias:city:v2:D',JSON.stringify({turnos:[]}));
values.set('publicity:city:v2:D',JSON.stringify({publicidades:[{...rows.get('publicidades/P'),estado:'ACTIVA',media:[rows.get('publicidad_media/M')],segmentacion:[rows.get('publicidad_segmentacion/G')]}]}));
values.set('guide:city:v1:D',JSON.stringify({anunciantes:[{id:'A',nombre:'Farmacia Test',ciudad_id:'D',sedes:[{sede_id:'SED',ciudad_id:'D',estado:'ACTIVA'}]}]}));
values.set('admin:catalogs:v2',JSON.stringify({moderacion_18:[]}));
let forceSedeConflict=false;
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const u=new URL(String(url));if(u.host==='oauth2.googleapis.com')return Response.json({access_token:'test',expires_in:3600});assert.equal(u.host,'firestore.googleapis.com');
 const body=options.body?JSON.parse(options.body):null;
 if(u.pathname.endsWith(':batchGet')){return Response.json(body.documents.map(name=>{const path=name.split('/documents/')[1],[c,id]=path.split('/'),row=rows.get(path);calls.push({op:'GET',c,id});const readTime='2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z';return row?{found:doc(c,id,row),readTime}:{missing:name,readTime};}));}
 if(u.pathname.endsWith(':commit')){
  if(forceSedeConflict){forceSedeConflict=false;const r=rows.get('anunciantes_sedes/SED2');seed('anunciantes_sedes','SED2',{...r,nodo_ids:['EXTERNO'],_version:'2026-10-12T12:00:01.000000Z'});}
  for(const w of body.writes){const name=w.delete||w.update.name;const path=name.split('/documents/')[1];const current=rows.get(path);const pre=w.currentDocument;
   if(pre?.exists===false&&current||pre?.exists===true&&!current||pre?.updateTime&&pre.updateTime!==(current?._version||'2026-10-12T12:00:00.000000Z'))return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:409});
  }
  for(const w of body.writes){const name=w.delete||w.update.name;const path=name.split('/documents/')[1];const [c,id]=path.split('/');calls.push({op:w.delete?'DELETE':'PATCH',c,id});if(w.delete){revision++;rows.delete(path);continue;}const patch=Object.fromEntries(Object.entries(w.update.fields).map(([k,v])=>[k,decode(v)]));seed(c,id,{...rows.get(path),...patch,_version:'2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z'});}
  return Response.json({writeResults:body.writes.map(()=>({updateTime:'2026-10-12T12:00:00.'+String(revision).padStart(6,'0')+'Z'}))});
 }
 if(u.pathname.endsWith(':runQuery')){const q=body.structuredQuery,c=q.from[0].collectionId;const f=q.where.fieldFilter;calls.push({op:'query',c});return Response.json([...rows.entries()].filter(([key,row])=>key.startsWith(c+'/')&&(f.op==='ARRAY_CONTAINS'?Array.isArray(row[f.field.fieldPath])&&row[f.field.fieldPath].includes(decode(f.value)):row[f.field.fieldPath]===decode(f.value))).slice(0,q.limit).map(([key,row])=>({document:doc(c,key.split('/')[1],row)})));}
 const path=u.pathname.split('/documents/')[1], [c,id]=path.split('/').map(decodeURIComponent);const method=options.method||'GET';calls.push({op:method,c,id});
 if(method==='GET'&&!id)return Response.json({documents:[...rows.entries()].filter(([key])=>key.startsWith(c+'/')).map(([key,row])=>doc(c,key.split('/')[1],row))});
 if(method==='PATCH'){if(u.searchParams.has('currentDocument.updateTime')&&u.searchParams.get('currentDocument.updateTime')!==(rows.get(c+'/'+id)._version||'2026-10-12T12:00:00.000000Z'))return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:409});if(u.searchParams.get('currentDocument.exists')==='false'&&rows.has(c+'/'+id))return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});const patch=Object.fromEntries(Object.entries(body.fields).map(([k,v])=>[k,decode(v)]));if(patch.vinculos_ciudades&&[...u.searchParams.getAll('updateMask.fieldPaths')].some(x=>x.startsWith('vinculos_ciudades.')))patch.vinculos_ciudades={...rows.get(c+'/'+id)?.vinculos_ciudades,...patch.vinculos_ciudades};seed(c,id,{...rows.get(c+'/'+id),...patch,_version:'2026-10-12T12:00:00.'+String(++revision).padStart(6,'0')+'Z'});return Response.json(doc(c,id,rows.get(c+'/'+id)));}
 if(method==='DELETE'){rows.delete(c+'/'+id);return new Response(null,{status:200});}
 const row=rows.get(c+'/'+id);return row?Response.json(doc(c,id,row)):Response.json({error:{message:'not found'}},{status:404});
};

seed('anunciantes','A',{anunciante_id:'A',nombre:'Comercio',ciudad_ids:['D']});
values.set('catalogs:publicidad:v1',JSON.stringify({categorias:[{categoria_id:'CAT',ubicacion_id:'U',nombre:'Deportes'}],ubicaciones:[{ubicacion_id:'U',modulo:'GUIA',nombre:'Guía'}]}));
let token='';
async function call(path,body){calls.length=0;const r=await worker.fetch(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({...body,declaracion_publicacion:{aceptada:true,version:'2026-10-10'}})}:{})}),env);return {r,j:await r.json(),calls:[...calls]};}
env.GLD_PUBLIC_CACHE=sqliteNamespace(env,GldPublicCache119);
const reports=[],measures=[],physical={get:0,put:0,delete:0,list:0};
globalThis.__circuitCapture=r=>reports.push(structuredClone(r));
for(const method of Object.keys(physical)){const original=env.GLD_CACHE_KV[method].bind(env.GLD_CACHE_KV);env.GLD_CACHE_KV[method]=async(...args)=>{physical[method]++;return original(...args);};}
env.GLD_PUBLIC_CACHE_MIGRATION='source-bootstrap';
const sign=p=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url');};
const adminToken=sign({sid:'ADMIN',rol:'SUPERADMIN_PRINCIPAL',persistent:true,sv:0});let ownerToken='';
const roles={admin:()=>adminToken,owner:()=>ownerToken,public:()=>''};
async function as(role,path,body){token=roles[role]();return call(path,body);}
async function ok(role,path,body){const x=await as(role,path,body);assert.equal(x.r.status,200,path+': '+JSON.stringify(x.j));assert.notEqual(x.j.success,false,path+': '+JSON.stringify(x.j));return x;}
async function stage(module,action,work){
 const start=reports.length,k={...physical},sql={...env.GLD_PUBLIC_CACHE.counts};
 try{await work();}catch(error){measures.push({module,action,passed:false,error:String(error.message)});throw error;}
 const current=reports.slice(start),sum=f=>current.reduce((n,r)=>n+(r.totals?.[f]||0),0);
 const measure={module,action,passed:true,requests:current.length,firestore:{read_calls:sum('read_calls'),documents_returned:sum('documents_returned'),writes:sum('write_calls'),deletes:sum('delete_calls')},cloudflare:{kv:Object.fromEntries(Object.keys(k).map(f=>[f,physical[f]-k[f]])),sql:{calls:env.GLD_PUBLIC_CACHE.counts.calls-sql.calls,rows_read:env.GLD_PUBLIC_CACHE.counts.read-sql.read,rows_written:env.GLD_PUBLIC_CACHE.counts.written-sql.written}}};
 measures.push(measure);fs.writeFileSync('circuits128/circuits.json',JSON.stringify(measures,null,2));
}
async function listed(kind,id){const x=await ok('admin','/superadmin/listados?tipo='+kind);return x.j.results.find(r=>r.id===id);}
async function publicRow(def,id){const x=await ok('public',def.public);return (x.j[def.publicField]||[]).find(r=>String(r[def.id]||r.id)===id);}
async function privateRow(def,id){const x=await ok('owner',def.panel,def.panelBody);return (x.j[def.field]||[]).find(r=>String(r[def.id]||r.id)===id);}
async function cross(def,id,{visible=true,present=true,title}={}){
 const p=await privateRow(def,id),g=await listed(def.kind,id),u=await publicRow(def,id);
 assert.equal(!!p,present,def.name+' advertiser presence');assert.equal(!!g,present,def.name+' GH presence');assert.equal(!!u,visible,def.name+' public visibility');
 if(title&&p){assert.equal(p[def.title],title);assert.equal(u?.[def.title],title);assert(JSON.stringify(g).includes(title));}
}



try{
 seed('anunciantes_administracion','A',{nivel:4,aprobado:true,funcionalidades:'EVENTOS,ACTIVIDADES',funcionalidades_config:{}});
 seed('anunciantes_sedes','SED2',{anunciante_id:'A',ciudad_id:'D',sede_id:'SED2'});
 const initial=await ok('admin','/superadmin/advertisers/A');const rev=initial.j.revision_perfil;
 const results=await Promise.all([as('admin','/superadmin/advertisers/A/profile',{payload:{revision_perfil:rev,pet:true}}),as('admin','/superadmin/advertisers/A/profile',{payload:{revision_perfil:rev,eco:true}})]);
 assert.deepEqual(results.map(x=>x.r.status).sort(),[200,409],JSON.stringify(results.map(x=>({status:x.r.status,body:x.j}))));
 const fresh=await ok('admin','/superadmin/advertisers/A');await ok('admin','/superadmin/advertisers/A/profile',{payload:{revision_perfil:fresh.j.revision_perfil,pet:true,eco:true}});
 assert.equal(rows.get('anunciantes/A').pet,true);assert.equal(rows.get('anunciantes/A').eco,true);
 const old=await as('admin','/superadmin/advertisers/A/profile',{payload:{revision_perfil:rev,pet:false}});assert.equal(old.r.status,409);assert.equal(rows.get('anunciantes/A').pet,true);
 const detail=await ok('admin','/superadmin/advertisers/A');const sedeRev=detail.j.revision_sedes.SED;
 const sedeResults=await Promise.all([as('admin','/superadmin/advertisers/A/sedes/relations',{sedes:[{sede_id:'SED',revision_sede:sedeRev,actividad_ids:['ACT1']}]}),as('admin','/superadmin/advertisers/A/sedes/relations',{sedes:[{sede_id:'SED',revision_sede:sedeRev,accion_ids:['ACC1']}]})]);
 assert.deepEqual(sedeResults.map(x=>x.r.status).sort(),[200,409]);
 const before=structuredClone(rows.get('anunciantes_sedes/SED'));const d=await ok('admin','/superadmin/advertisers/A');
 forceSedeConflict=true;
 const atomic=await as('admin','/superadmin/advertisers/A/sedes/relations',{sedes:[{sede_id:'SED',revision_sede:d.j.revision_sedes.SED,nodo_ids:['N1']},{sede_id:'SED2',revision_sede:d.j.revision_sedes.SED2,actividad_ids:['A2']}]});
 assert.equal(atomic.r.status,409);assert.deepEqual(rows.get('anunciantes_sedes/SED'),before);assert.deepEqual(rows.get('anunciantes_sedes/SED2').nodo_ids,['EXTERNO']);assert.equal(rows.get('anunciantes_sedes/SED2').actividad_ids,undefined);
 fs.writeFileSync('cierre-integral/guardado-perfil-sedes-prueba.json',JSON.stringify({profileStatuses:results.map(x=>x.r.status),sedeStatuses:sedeResults.map(x=>x.r.status),atomicConflictStatus:atomic.r.status,noPartialWrites:true},null,2));
 console.log('PASS: perfil y sedes rechazan guardados simultáneos/viejos; conflicto en segunda sede no deja primera sede parcialmente guardada.');
}finally{globalThis.fetch=original;delete globalThis.__circuitCapture;}
