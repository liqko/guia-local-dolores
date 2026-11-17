import test from 'node:test';
import assert from 'node:assert/strict';
import {source} from './worker-source.mjs';
const exposed=source+'\nexport {withPanelCacheV48,eventsPanelDataV2,actividadesPanelData,promosPanelDataV2,publicidadPanelDataV2,KEYS,GLD_FUNC_KEY166};\n//# sourceURL=worker-panel-211.js';
const mod=await import('data:text/javascript;base64,'+Buffer.from(exposed).toString('base64'));
function fixture(){
 const calls=[],values=new Map();
 const rules={revision:1,reglas:{EVENTOS_FREE:{altas_mensuales_max:3,activas_max:3,guardadas_max:6}}};
 values.set(mod.GLD_FUNC_KEY166,rules);
 values.set(mod.KEYS.commerce,{categorias:[],niveles_anunciante:[],panel_function_rules210:rules});
 values.set('publicity:contract:v101:A',{activas_max:3,guardadas_max:6});
 const cache={async get(key){return values.get(key)||null;},async put(){throw Error('No debe escribir catálogos preparados');}};
 const raw={async get(c,id){calls.push({kind:'get',c,id});return null;},async queryEqual(c,field,id){calls.push({kind:'query',c,field,id});return [];}};
 const actor={metrics:{rows_read:0,rows_written:0},async commerceMaster209(body){calls.push({kind:'master',aid:body.aid,op:body.op});return {success:true,advertiser:{administracion:{nivel:6},datos:{id:body.aid,nombre:'Cuenta de ensayo'},sedes:[]}};}};
 const env={__gldGuideActor132:actor},report={};
 return {db:mod.withPanelCacheV48(raw,env,report),cache,calls};
}
test('El lector privado conserva el acceso a la copia común y el alcance del anunciante',async()=>{
 const f=fixture(),read=f.db.panelReadDb({advertiserId:'A'});
 assert.equal(typeof read.commerceMasterRead209,'function');
 assert.equal(read.commerceMasterRead209,f.db.commerceMasterRead209,'Debe conservar la misma operación, no otra implementación');
 await read.commerceMasterRead209('A');assert.deepEqual(f.calls,[{kind:'master',aid:'A',op:'commerce-master-read209'}]);
});
for(const [name,fn,args,collection] of [
 ['Eventos',mod.eventsPanelDataV2,{featureEnabled:()=>true,cupo:()=>3},'eventos'],
 ['Actividades',mod.actividadesPanelData,{featureAllowed:()=>true,cupoMax:()=>3},'actividades'],
 ['Promociones',mod.promosPanelDataV2,{cupoFromAdmin:()=>3},'promos'],
 ['Publicidad',mod.publicidadPanelDataV2,{featureEnabled:()=>true,configFromAdmin:()=>({activas_max:3,guardadas_max:6})},'publicidades']
])test(name+': abre usando la copia preparada, sin reconstruir datos del anunciante',async()=>{
 const f=fixture();const response=await fn({db:f.db,cache:f.cache,advertiserId:'A',...args});
 assert.equal(response.success,true);
 assert.deepEqual(f.calls.filter(x=>x.kind==='master'),[{kind:'master',aid:'A',op:'commerce-master-read209'}]);
 assert.equal(f.calls.filter(x=>x.kind==='query'&&x.c===collection&&x.id==='A').length,1);
 assert.equal(f.calls.filter(x=>x.kind==='get'&&['anunciantes','anunciantes_datos','anunciantes_administracion','anunciantes_sedes'].includes(x.c)).length,0);
});
