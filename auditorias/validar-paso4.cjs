// Paso 4: puerta de control del inventario único. No crea otro catálogo.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'..');
const inv=JSON.parse(fs.readFileSync(path.join(__dirname,'PASO4_INTERVENCIONES.json'),'utf8'));
const master=fs.readFileSync(path.join(__dirname,'ESTADO_ACTUAL.md'),'utf8');
const states=['pendiente_diagnostico','diagnosticada','en_correccion','corregida_probada_local','publicada_verificada','bloqueada'];
const rows=inv.intervenciones;
assert(Array.isArray(rows)&&rows.length>0,'Inventario P4 vacío');
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'ID P4 duplicado');
const required=['id','funcionalidad','problema','sintomas','evidencia','aud','prioridad','causa','estado','correccion','pruebas','consumos','commits','publicacion','siguiente'];
const counts=Object.fromEntries(states.map(s=>[s,0]));
for(let i=0;i<rows.length;i++){
 const r=rows[i];
 for(const field of required)assert(Object.hasOwn(r,field),r.id+': falta '+field);
 assert.equal(r.id,'P4-'+String(i+1).padStart(4,'0'),'IDs P4 deben preservarse estables en orden');
 assert(states.includes(r.estado),r.id+': estado inválido');
 assert(['critica','alta','posterior'].includes(r.prioridad),r.id+': prioridad inválida');
 assert(Array.isArray(r.evidencia)&&r.evidencia.length,r.id+': sin evidencia');
 assert(Array.isArray(r.aud),r.id+': AUD debe ser array');
 assert(Array.isArray(r.pruebas)&&Array.isArray(r.commits),r.id+': pruebas/commits inválidos');
 assert(r.consumos&&Object.hasOwn(r.consumos,'antes')&&Object.hasOwn(r.consumos,'despues'),r.id+': comparativa incompleta');
 counts[r.estado]++;
}
const measured=rows.filter(r=>r.consumos.antes!==null&&r.consumos.despues!==null).length;
const map={
 'Total de intervenciones identificadas':rows.length,
 'Pendientes de diagnóstico':counts.pendiente_diagnostico,
 'Diagnosticadas':counts.diagnosticada,
 'En corrección':counts.en_correccion,
 'Corregidas y probadas localmente':counts.corregida_probada_local,
 'Publicadas y verificadas':counts.publicada_verificada,
 'Bloqueadas':counts.bloqueada,
 'Mediciones comparativas completas':measured
};
const start=master.indexOf('## PASO 4 — CONTROL GENERAL');
assert(start>=0,'Falta tablero del Paso 4 en registro maestro');
const section=master.slice(start,start+3000);
for(const [label,n] of Object.entries(map)){
 assert(section.includes(label+': '+n),label+' desactualizado: '+n);
}
console.log('PASO4_TABLERO_PASS '+JSON.stringify({total:rows.length,estados:counts,mediciones:measured,prioridades:rows.reduce((o,r)=>(o[r.prioridad]=(o[r.prioridad]||0)+1,o),{})}));
