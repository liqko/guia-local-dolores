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
 assert(Array.isArray(r.objetivos)&&r.objetivos.length>0&&r.objetivos.every(n=>Number.isInteger(n)&&n>=1&&n<=4),r.id+': objetivos obligatorios inválidos');

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
const cases=inv.hallazgos_historicos||[];
assert(cases.length>0&&new Set(cases.map(x=>x.hallazgo)).size===cases.length,'Hallazgos históricos duplicados o vacíos');
for(const h of cases){
 assert(['incorporado','agrupado','ya_corregido','historicamente_reemplazado','pendiente_confirmar'].includes(h.resolucion),'Resolución histórica no reconocida: '+h.hallazgo);
 assert(h.fuente&&h.nota,'Falta evidencia documental: '+h.hallazgo);
 if(h.intervencion)assert(rows.some(r=>r.id===h.intervencion),'Referencia histórica a P4 inexistente: '+h.hallazgo);
}
assert.equal(inv.estadisticas_cobertura.hallazgos_documentales_trazados,cases.length,'Contador histórico desactualizado');
assert.equal(inv.estadisticas_cobertura.intervenciones_unicas,rows.length,'Contador de causas desactualizado');
assert(!inv.cobertura_documental.completo,'No declarar cierre con anexos pendientes');
assert.equal(inv.cobertura_documental.fuentes_pendientes_de_cotejo.length,inv.estadisticas_cobertura.fuentes_pendientes,'Fuentes pendientes inconsistentes');
const grouped=Object.values(inv.grupos_funcionales||{}).flat();
assert.equal(grouped.length,rows.length,'Grupos funcionales no cubren todo el inventario');
assert.equal(new Set(grouped).size,rows.length,'Intervención repetida en grupos funcionales');
for(const id of grouped)assert(rows.some(r=>r.id===id),'Grupo con ID inexistente: '+id);

const allTasks=rows.flatMap(r=>r.tareas||[]);
const tasksById=new Map();
for(const row of rows){
 assert(Array.isArray(row.tareas)&&row.tareas.length>0,row.id+': faltan tareas');
 for(let i=0;i<row.tareas.length;i++){
  const t=row.tareas[i];
  assert.equal(t.id,row.id+'-T'+String(i+1).padStart(2,'0'),'Tarea fuera de su P4 o con secuencia inválida');
  assert(!tasksById.has(t.id),'Tarea duplicada '+t.id);tasksById.set(t.id,t);
  for(const field of ['problema','evidencia_historica','accion_necesaria','estado','correccion_aplicada','prueba','resultado_prueba','consumos','hallazgos_ids'])
   assert(Object.hasOwn(t,field),t.id+': falta '+field);
  assert(['pendiente','preparada','probada_aislada','terminada_verificada','bloqueada'].includes(t.estado),'Estado de tarea inválido');
  assert(t.problema&&t.accion_necesaria&&t.resultado_prueba,'Tarea sin acción/resultado');
  assert(t.consumos&&Object.hasOwn(t.consumos,'antes')&&Object.hasOwn(t.consumos,'despues'),'Consumo incompleto '+t.id);
 }
}
// Ejecuciones técnicas: orden único, sin duplicar fichas en otro catálogo.
const orden=inv.orden_ejecuciones;
assert(Array.isArray(orden)&&orden.length===allTasks.length,'Total de ejecuciones distinto del total de tareas');
assert.equal(new Set(orden).size,orden.length,'Numeración con tarea duplicada');
for(let i=0;i<allTasks.length;i++){
 const t=allTasks[i];
 assert.equal(t.numero_ejecucion,i+1,'Número correlativo inválido '+t.id);
 assert.equal(orden[i],t.id,'Índice de ejecución distinto a la tarea canónica '+t.id);
}
for(const g of inv.errores_http_5xx?.grupos||[]){
 const tarea=tasksById.get(g.tarea_id);
 assert(tarea,'HTTP sin tarea '+g.ruta);
 assert.equal(tarea.consumos.antes?.ruta,g.ruta,'Métrica de otra ruta en '+tarea.id);
 assert.equal(tarea.consumos.antes?.metodo,g.metodo,'Método no corresponde en '+tarea.id);
 assert.equal(tarea.consumos.antes?.http_5xx,g.cantidad,'Cantidad HTTP5xx incongruente '+tarea.id);
}
console.log('PASO4_EJECUCIONES_PASS '+JSON.stringify({ejecuciones:orden.length,primera:orden[0],ultima:orden.at(-1)}));

for(const h of cases){
 assert(h.destino?.p4&&h.destino?.tarea_id,'Hallazgo sin destino '+h.hallazgo);
 assert(tasksById.has(h.destino.tarea_id),'Hallazgo con tarea inexistente '+h.hallazgo);
 assert(h.destino.tarea_id.startsWith(h.destino.p4+'-'),'Hallazgo y tarea de distinto P4 '+h.hallazgo);
 assert(['pendiente_individual','historico_sin_revalidacion_total','vinculado_no_cerrado'].includes(h.cotejo),'Cotejo inválido '+h.hallazgo);
 assert(tasksById.get(h.destino.tarea_id).hallazgos_ids.includes(h.hallazgo),'La tarea no enlaza su hallazgo '+h.hallazgo);
}
for(const t of allTasks)for(const id of t.hallazgos_ids)
 assert(cases.some(h=>h.hallazgo===id&&h.destino.tarea_id===t.id),'Tarea con hallazgo no recíproco '+t.id+' '+id);
const http=inv.errores_http_5xx;
assert(http&&Array.isArray(http.grupos),'Falta P4-0035 por ruta');
assert.equal(http.grupos.reduce((sum,x)=>sum+x.cantidad,0),http.total_respuestas,'HTTP5xx total no reconstruible');
assert.equal(http.grupos.length,9,'Deben conservarse nueve combinaciones ruta/método');
assert.equal(new Set(http.grupos.map(x=>x.metodo+' '+x.ruta)).size,http.grupos.length,'Grupo HTTP duplicado');
for(const g of http.grupos)assert(g.tarea_id?.startsWith('P4-0035-')&&tasksById.has(g.tarea_id),'HTTP5xx sin tarea P4-0035');
const board={
 intervenciones:rows.length,
 hallazgos_historicos:cases.length,
 hallazgos_con_destino:cases.filter(x=>x.destino?.tarea_id).length,
 hallazgos_pendientes_cotejo:cases.filter(x=>x.cotejo==='pendiente_individual').length,
 tareas:allTasks.length,
 tareas_terminadas_verificadas:allTasks.filter(x=>x.estado==='terminada_verificada').length,
 tareas_pendientes:allTasks.filter(x=>x.estado!=='terminada_verificada').length,
 correcciones_preparadas:allTasks.filter(x=>x.estado==='preparada').length,
 publicadas_verificadas:counts.publicada_verificada
};
assert.deepEqual(inv.tablero_trazabilidad,board,'Tablero de tareas/hallazgos no reconstruible');
assert.equal(inv.estadisticas_cobertura.hallazgos_pendientes_cotejo_individual,board.hallazgos_pendientes_cotejo,'Pendientes documentales inconsistentes');
console.log('PASO4_TRAZABILIDAD_PASS '+JSON.stringify(board));

console.log('PASO4_TABLERO_PASS '+JSON.stringify({total:rows.length,estados:counts,mediciones:measured,prioridades:rows.reduce((o,r)=>(o[r.prioridad]=(o[r.prioridad]||0)+1,o),{})}));
