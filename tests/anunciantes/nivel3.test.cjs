/* Unidad 3: asignación automática del nivel 3. Ejecuta las funciones del Worker único. */
const fs=require('fs'),assert=require('node:assert/strict'),test=require('node:test');
const src=fs.readFileSync(__dirname+'/../../worker/worker206.txt','utf8');
const i=src.indexOf("const DEFAULT_ADVERTISER_LEVEL155"),j=src.indexOf('async function commitNewOwnership155');
assert.ok(i>0&&j>i,'funciones de nivel en el Worker');
const {newAdvertiserLevel155,moderatedCreation155}=new Function(src.slice(i,j)+'\nreturn {newAdvertiserLevel155,moderatedCreation155};')();
test('nivel por defecto 3 y elección explícita de GH conservada',()=>{
 assert.equal(newAdvertiserLevel155(),'3');assert.equal(newAdvertiserLevel155(''),'3');assert.equal(newAdvertiserLevel155('  '),'3');
 assert.equal(newAdvertiserLevel155(null),'3');assert.equal(newAdvertiserLevel155('5'),'5');assert.equal(newAdvertiserLevel155(4),'4');
});
test('alta moderada sin nivel elegido crea administración con nivel 3',()=>{
 const c=moderatedCreation155({nombre:'X',ciudad_id:'C1',detalle:{}},'AID',newAdvertiserLevel155(undefined),'2026-11-27T00:00:00Z');
 assert.equal(c.admin.nivel,'3');assert.equal(c.admin.aprobado,true);assert.equal(c.sedes.length,1);
});
test('todas las rutas de alta usan el nivel automático; no queda rechazo por nivel ausente',()=>{
 assert.equal(src.includes('Seleccioná el nivel del nuevo anunciante.'),false);
 assert.equal((src.match(/const level = newAdvertiserLevel155\(nivel\);/g)||[]).length,2);
 assert.ok(src.includes("admin:{id:aid,aprobado:true,nivel:newAdvertiserLevel155(),"),'autoalta del panel');
 const gh=fs.readFileSync(__dirname+'/../../plataforma/administracion.html','utf8');
 assert.ok(gh.includes("payload.nivel=sel.value||'3';"));assert.ok(gh.includes("(v==='3'?' selected':'')"));
 assert.equal(gh.includes('Seleccioná el nivel para aprobar el nuevo anunciante.'),false);
});
