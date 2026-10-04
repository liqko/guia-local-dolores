import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {routePanelV15} from '../worker/routes/panel-v15.js';
import {routeAdminV11} from '../worker/routes/admin-v11.js';
import worker from '../worker/app-main-v33.js';
import {createEventV3,duplicateVipV3} from '../worker/modules/eventos-v3.js';
import {promoCreateV2} from '../worker/modules/promos-v2.js';

const clone=x=>x==null?x:structuredClone(x);
function fixture(){
  const collections=new Map(),kv=new Map(),stats={reads:0,writes:0,queries:0,scans:0};
  const collection=c=>{if(!collections.has(c))collections.set(c,new Map());return collections.get(c)};
  const db={
    async get(c,id){stats.reads++;return clone(collection(c).get(id)||null)},
    async queryEqual(c,k,v,limit=1000){stats.queries++;return clone([...collection(c).values()].filter(x=>x[k]===v).slice(0,limit))},
    async patch(c,id,p,{mustExist=false}={}){if(mustExist&&!collection(c).has(id))throw new Error('Documento inexistente');stats.writes++;const row={id,...collection(c).get(id),...clone(p)};collection(c).set(id,row);return clone(row)},
    async delete(c,id){stats.writes++;collection(c).delete(id)},
    async listCollection(){stats.scans++;throw new Error('Scan global durante una acción normal')}
  };
  const cache={async get(k){return clone(kv.get(k)||null)},async put(k,v){kv.set(k,clone(v))}};
  const env={SERVER_SECRET:'solo-pruebas',GLD_CACHE_KV:{async get(k){return kv.has(k)?JSON.stringify(kv.get(k)):null},async put(k,v){kv.set(k,JSON.parse(v))}}};
  const sign=p=>{const b=Buffer.from(JSON.stringify({...p,exp:Date.now()+60000})).toString('base64url');return b+'.'+createHmac('sha256',env.SERVER_SECRET).update(b).digest('base64url')};
  const subscriber=sign({sid:'SUB',typ:'GLD_SUBSCRIBER',auth:[{anunciante_id:'ADV',rol:'PROPIETARIO',permisos:'PROMOS;EVENTOS;EVENTOS_FREE;ACTIVIDADES;PUBLICIDAD;EFEMERIDES'}]});
  const admin=sign({sid:'ADM',rol:'SUPERADMIN_PRINCIPAL'});
  function seed(c,id,data){collection(c).set(id,{id,...clone(data)})}
  seed('anunciantes','ADV',{nombre:'Anunciante'});
  seed('anunciantes_administracion','ADV',{funcionalidades:['PROMOS','EVENTOS','EVENTOS_FREE','ACTIVIDADES','PUBLICIDAD','EFEMERIDES'],funcionalidades_config:{PROMOS:{cantidad:3},EVENTOS:{cantidad:3},EVENTOS_FREE:{cantidad:3},ACTIVIDADES:{cantidad:1},PUBLICIDAD:{guardadas_max:2,activas_max:1,cambios_activos_por_dia_max:4}},efemerides_local:true,efemerides_ciudades:['DOL','CAS']});
  kv.set('territorio:public:v1',{ciudades:[{ciudad_id:'DOL',provincia_id:'BA'},{ciudad_id:'CAS',provincia_id:'BA'}]});
  kv.set('catalogs:publicidad:v1',{ubicaciones:[{ubicacion_id:'UG',modulo:'GUIA'}]});
  kv.set('catalogs:promos:v1',{categorias:[{categoria_id:'CAT',nombre:'Gastronomía'}]});
  const event={nombre_evento:'Encuentro',categoria:'Cultura',ciudad_id:'DOL',fecha_desde:'2026-10-10',lugar_texto:'Plaza',direccion:'Centro',programacion:[{fecha:'2026-10-10',ciudad_id:'DOL',lugar_texto:'Plaza',direccion:'Centro'}]};
  const schedule=city=>({ciudad_id:city,tipo_lugar:'FISICO',lugar_texto:'Club',direccion:'Centro'});
  async function request(path,body,token=subscriber){
    const url=new URL('https://prueba.local'+path);
    const req=new Request(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({advertiserId:'ADV',...body})});
    const ctx={path:url.pathname,url,request:req,db,cache,env};
    return await (path.startsWith('/superadmin')?routeAdminV11(ctx):routePanelV15(ctx));
  }
  async function action(path,body,token){const r=await request(path,body,token);assert.ok(r,'Ruta sin respuesta');const out=await r.json();assert.equal(r.status,200,JSON.stringify(out));assert.equal(out.success,true,JSON.stringify(out));return out}
  async function publicRows(path,city,key){
    const before={...stats};
    const r=await worker.fetch(new Request(`https://prueba.local${path}${path.includes('?')?'&':'?'}ciudad_id=${city}`),env);
    const out=await r.json();assert.equal(r.status,200,JSON.stringify(out));assert.equal(out.success,true,JSON.stringify(out));assert.deepEqual(stats,before,'La consulta pública accedió a Firestore');return out[key];
  }
  return{db,cache,env,stats,seed,collection,action,request,publicRows,admin,event,schedule};
}
const cases=[];
function test(name,fn){cases.push({name,fn})}

test('Promos: alta, cambio de ciudad, pausa, reanudación, baja y permiso',async()=>{
  const f=fixture();
  const p=await f.action('/promos',{action:'createpromo',payload:{promo:'2x1',categoria_id:'CAT',ciudad_id:'DOL'}});
  const id=p.promo.promo_id;
  assert.equal((await f.publicRows('/promos','DOL','promos')).length,1);
  await f.action('/promos',{action:'updatepromo',payload:{promo_id:id,ciudad_id:'CAS',promo:'3x2'}});
  assert.equal((await f.publicRows('/promos','DOL','promos')).length,0);
  assert.equal((await f.publicRows('/promos','CAS','promos'))[0].promo,'3x2');
  await f.action('/promos',{action:'updatepromo',payload:{promo_id:id,pausado:true}});
  assert.equal((await f.publicRows('/promos','CAS','promos')).length,0);
  await f.action('/promos',{action:'updatepromo',payload:{promo_id:id,pausado:false}});
  const noAuth=await f.request('/promos',{action:'deletepromo',payload:{promo_id:id}},'');assert.equal(noAuth.status,401);
  const before=f.stats.writes;
  await assert.rejects(()=>f.action('/promos',{action:'deletepromo',advertiserId:'OTRO',payload:{promo_id:id}}),/permiso/);
  assert.equal(f.stats.writes,before);
  await f.action('/promos',{action:'deletepromo',payload:{promo_id:id}});
  assert.equal((await f.publicRows('/promos','CAS','promos')).length,0);
});

test('Promos: un alta no puede sobrescribir un ID de otro anunciante',async()=>{
  const f=fixture();f.seed('promos','AJENA',{promo_id:'AJENA',anunciante_id:'OTRO',ciudad_id:'CAS',promo:'Original'});
  await assert.rejects(()=>promoCreateV2({...f,advertiserId:'ADV',body:{payload:{promo_id:'AJENA',promo:'Intento',categoria_id:'CAT',ciudad_id:'DOL'}},cupoFromAdmin:()=>3}));
  assert.equal((await f.db.get('promos','AJENA')).promo,'Original');
});

test('Eventos: alta pendiente, aprobar, editar, rechazar y eliminar',async()=>{
  const f=fixture();
  const e=await f.action('/events-new',{action:'createvipevent',payload:f.event});const id=e.evento_id;
  assert.equal((await f.publicRows('/events-new','DOL','events')).length,0);
  await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'APROBAR'},f.admin);
  assert.equal((await f.publicRows('/events-new','DOL','events'))[0].programacion.length,1);
  await f.action('/events-new',{action:'updatevipevent',payload:{evento_id:id,nombre_evento:'Editado'}});
  assert.equal((await f.publicRows('/events-new','DOL','events')).length,0);
  await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id,decision:'RECHAZAR'},f.admin);
  assert.equal((await f.publicRows('/events-new','DOL','events')).length,0);
  await f.action('/events-new',{action:'deletevipevent',payload:{evento_id:id}});
  assert.equal((await f.db.queryEqual('evento_programacion','evento_id',id)).length,0);
});

test('Eventos: duplicar conserva la programación del original y genera IDs propios',async()=>{
  const f=fixture();const original=await createEventV3({...f,advertiserId:'ADV',payload:f.event,max:3});
  const before=await f.db.queryEqual('evento_programacion','evento_id',original.evento_id);
  const copy=await duplicateVipV3({...f,advertiserId:'ADV',payload:{evento_id:original.evento_id},max:3});
  assert.deepEqual(await f.db.queryEqual('evento_programacion','evento_id',original.evento_id),before);
  const programs=await f.db.queryEqual('evento_programacion','evento_id',copy.evento_id);
  assert.equal(programs.length,before.length);
  assert.notEqual(programs[0].evento_programacion_id,before[0].evento_programacion_id);
  assert.deepEqual(copy.evento.programacion,programs);
});

test('Actividades: aprobar, editar horarios a otra ciudad, pausar y eliminar',async()=>{
  const f=fixture();const a=await f.action('/actividades',{action:'guardar',payload:{nombre:'Yoga',categoria:'Deporte',horarios:[f.schedule('DOL')]}});const id=a.actividad_id;
  assert.equal((await f.publicRows('/actividades?action=publicas','DOL','actividades')).length,0);
  await f.action('/superadmin/moderation/resolve',{tipo:'ACTIVIDAD',id,decision:'APROBAR'},f.admin);
  assert.equal((await f.publicRows('/actividades?action=publicas','DOL','actividades')).length,1);
  await f.action('/actividades',{action:'guardar',payload:{actividad_id:id,nombre:'Yoga II',horarios:[f.schedule('CAS')]}});
  assert.equal((await f.publicRows('/actividades?action=publicas','DOL','actividades')).length,0);
  assert.equal((await f.publicRows('/actividades?action=publicas','CAS','actividades'))[0].nombre,'Yoga II');
  await f.action('/actividades',{action:'pausar',actividad_id:id});
  assert.equal((await f.publicRows('/actividades?action=publicas','CAS','actividades')).length,0);
  await f.action('/actividades',{action:'eliminar',actividad_id:id});
  assert.equal((await f.db.queryEqual('actividad_horarios','actividad_id',id)).length,0);
});

test('Actividades: reanudar/renovar no permite exceder el cupo',async()=>{
  const f=fixture();const a=await f.action('/actividades',{action:'guardar',payload:{nombre:'Yoga',categoria:'Deporte',horarios:[f.schedule('DOL')]}});
  await f.action('/actividades',{action:'pausar',actividad_id:a.actividad_id});
  await f.action('/actividades',{action:'guardar',payload:{nombre:'Fútbol',categoria:'Deporte',horarios:[f.schedule('DOL')]}});
  for(const action of ['reanudar','renovar'])await assert.rejects(()=>f.action('/actividades',{action,actividad_id:a.actividad_id}),/cupo/);
  assert.equal((await f.db.get('actividades',a.actividad_id)).activo,false);
});

test('Efemérides: guardar, mover de ciudad, desactivar, activar y eliminar',async()=>{
  const f=fixture();const e=await f.action('/efemerides',{action:'guardar',payload:{nombre:'Día local',tipo:'LOCAL',ciudad_id:'DOL',tipo_fecha:'FIJA',mes:10,dia:10}});const id=e.efemeride.efemeride_id;
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-10','DOL','efemerides')).length,1);
  await f.action('/efemerides',{action:'guardar',payload:{efemeride_id:id,ciudad_id:'CAS'}});
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-10','DOL','efemerides')).length,0);
  await f.action('/efemerides',{action:'desactivar',efemeride_id:id});
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-10','CAS','efemerides')).length,0);
  await f.action('/efemerides',{action:'activar',efemeride_id:id});
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-10','CAS','efemerides')).length,1);
  await f.action('/efemerides',{action:'eliminar',efemeride_id:id});
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-10','CAS','efemerides')).length,0);
});


test('Publicidad: guardar, activar, mover de ciudad, desactivar y borrar',async()=>{
  const f=fixture();const p=await f.action('/publicidad',{action:'guardar',payload:{titulo:'Oferta',formato:'IMAGEN',media:[{url:'https://ejemplo.test/banner.jpg'}],ciudades:['DOL'],categorias:['UG:CAT']}});const id=p.publicidad_id;
  assert.equal((await f.publicRows('/publicidad?action=publicas&modulo=GUIA','DOL','publicidades')).length,0);
  await f.action('/publicidad',{action:'actualizar_activos',publicidad_ids:[id]});
  assert.equal((await f.publicRows('/publicidad?action=publicas&modulo=GUIA','DOL','publicidades'))[0].img,'https://ejemplo.test/banner.jpg');
  await f.action('/publicidad',{action:'guardar',payload:{publicidad_id:id,ciudades:['CAS'],categorias:['UG:CAT']}});
  assert.equal((await f.publicRows('/publicidad?action=publicas&modulo=GUIA','DOL','publicidades')).length,0);
  assert.equal((await f.publicRows('/publicidad?action=publicas&modulo=GUIA','CAS','publicidades')).length,1);
  await assert.rejects(()=>f.action('/publicidad',{action:'eliminar',publicidad_id:id}),/activa_no_eliminable/);
  await f.action('/publicidad',{action:'actualizar_activos',publicidad_ids:[]});
  await f.action('/publicidad',{action:'eliminar',publicidad_id:id});
  assert.equal((await f.db.queryEqual('publicidad_media','publicidad_id',id)).length,0);
  assert.equal((await f.db.queryEqual('publicidad_segmentacion','publicidad_id',id)).length,0);
  assert.equal((await f.publicRows('/publicidad?action=publicas&modulo=GUIA','CAS','publicidades')).length,0);
});

test('Publicidad: no excede el máximo guardado ni crea al editar un ID inexistente',async()=>{
  const f=fixture();for(let i=0;i<2;i++)await f.action('/publicidad',{action:'guardar',payload:{titulo:'Oferta '+i}});
  await assert.rejects(()=>f.action('/publicidad',{action:'guardar',payload:{titulo:'Tercera'}}),/guardadas/);
  await assert.rejects(()=>f.action('/publicidad',{action:'guardar',payload:{publicidad_id:'NO-EXISTE',titulo:'Editar'}}),/encontrada/);
  assert.equal((await f.db.queryEqual('publicidades','anunciante_id','ADV')).length,2);
});

test('Actividades: la lectura pública excluye vencidas sin mutaciones ni recargas',async()=>{
  const f=fixture();await f.cache.put('activities:city:v2:DOL',{actividades:[{actividad_id:'VENCIDA',activo:true,aprobado:true,estado:'ACTIVA',vigente_hasta:'2000-01-01'}]});
  assert.equal((await f.publicRows('/actividades?action=publicas','DOL','actividades')).length,0);
});

test('Efemérides móviles: MÓVIL y última semana conservan el significado del formulario',async()=>{
  const f=fixture();const e=await f.action('/efemerides',{action:'guardar',payload:{nombre:'Último domingo',tipo:'LOCAL',ciudad_id:'DOL',tipo_fecha:'MÓVIL',mes:'10',semana_mes:'ULTIMA',dia_semana:'DOMINGO'}});
  assert.equal(e.efemeride.tipo_fecha,'MOVIL');
  assert.equal(e.efemeride.semana_mes,'ULTIMA');
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-25','DOL','efemerides')).length,1);
  assert.equal((await f.publicRows('/efemerides?action=publicas&fecha=2026-10-18','DOL','efemerides')).length,0);
});


test('Publicidad: el límite diario no se consume al repetir la misma selección',async()=>{
  const f=fixture();const p=await f.action('/publicidad',{action:'guardar',payload:{titulo:'Oferta'}});
  for(let i=0;i<4;i++){
    const ids=i%2===0?[p.publicidad_id]:[];
    const changed=await f.action('/publicidad',{action:'actualizar_activos',publicidad_ids:ids});
    assert.equal(changed.cambios_activos.usados,i+1);
    const repeated=await f.action('/publicidad',{action:'actualizar_activos',publicidad_ids:ids});
    assert.equal(repeated.sin_cambios,true);
  }
  await assert.rejects(()=>f.action('/publicidad',{action:'actualizar_activos',publicidad_ids:[p.publicidad_id]}),/diario_agotado/);
});

test('Eventos FREE: confirmación de similares, moderación y pausa/reanudación',async()=>{
  const f=fixture();
  const first=await f.action('/events-new',{action:'createfreeevent',payload:{...f.event,acepta_responsabilidad:true}});
  const r=await f.request('/events-new',{action:'createfreeevent',payload:{...f.event,acepta_responsabilidad:true}});
  const duplicate=await r.json();assert.equal(duplicate.requires_confirmation,true);
  assert.equal((await f.db.queryEqual('eventos','anunciante_id','ADV')).length,1);
  await f.action('/superadmin/moderation/resolve',{tipo:'EVENTO',id:first.evento_id,decision:'APROBAR'},f.admin);
  await f.action('/events-new',{action:'pausefreeevent',payload:{evento_id:first.evento_id,pause:true}});
  assert.equal((await f.publicRows('/events-new','DOL','events')).length,0);
  await f.action('/events-new',{action:'pausefreeevent',payload:{evento_id:first.evento_id,pause:false}});
  assert.equal((await f.publicRows('/events-new','DOL','events')).length,1);
  await f.action('/events-new',{action:'deletefreeevent',payload:{evento_id:first.evento_id}});
  assert.equal((await f.publicRows('/events-new','DOL','events')).length,0);
});

test('Efemérides: fecha inválida se rechaza antes de escribir',async()=>{
  const f=fixture();for(const fields of [{tipo_fecha:'FIJA',mes:2,dia:30},{tipo_fecha:'MOVIL',mes:10,semana_mes:6,dia_semana:'DOMINGO'}]){
    const before=f.stats.writes;
    await assert.rejects(()=>f.action('/efemerides',{action:'guardar',payload:{nombre:'Inválida',tipo:'LOCAL',ciudad_id:'DOL',...fields}}),/inválid/);
    assert.equal(f.stats.writes,before);
  }
});

test('Efemérides: no permite trasladar un contenido fuera de tu permiso a tu ciudad',async()=>{
  const f=fixture();f.seed('anunciantes_administracion','ADV',{efemerides_local:true,efemerides_ciudades:['DOL']});
  f.seed('efemerides_bis','AJENA',{efemeride_id:'AJENA',tipo:'LOCAL',ciudad_id:'CAS',tipo_fecha:'FIJA',mes:10,dia:10,nombre:'Original'});
  const before=f.stats.writes;
  await assert.rejects(()=>f.action('/efemerides',{action:'guardar',payload:{efemeride_id:'AJENA',ciudad_id:'DOL'}}),/No autorizado/);
  assert.equal(f.stats.writes,before);
  assert.equal((await f.db.get('efemerides_bis','AJENA')).ciudad_id,'CAS');
});

let failures=0;
for(const c of cases){try{await c.fn();console.log('OK:',c.name)}catch(e){failures++;console.error('FALLÓ:',c.name,'\n',e.message)}}
assert.equal(failures,0,`${failures} circuitos fallaron`);
console.log(`MUTACIONES V33 OK: ${cases.length} circuitos completos con rutas privadas y lectura pública del Worker real`);
