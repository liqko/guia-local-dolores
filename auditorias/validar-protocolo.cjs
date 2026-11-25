#!/usr/bin/env node
'use strict';
// Control de avance de auditoría. No sustituye pruebas reales ni controles de rama protegida.
const fs=require('node:fs');
const cp=require('node:child_process');
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const root=process.cwd();
// El validador habitual no puede aprobar cierres sin comprobar integridad de fuentes y pruebas.
cp.execFileSync(process.execPath,['auditorias/control-integridad.cjs','--check'],{cwd:root,stdio:'inherit'});
// El grafo debe regenerarse sobre las fuentes actuales, nunca desde un informe escrito a mano.
cp.execFileSync(process.execPath,['auditorias/generar-mapa-gps.cjs','--check'],{cwd:root,stdio:'inherit'});
cp.execFileSync(process.execPath,['auditorias/arbol-estatico.cjs','--check'],{cwd:root,stdio:'inherit'});
const file=p=>fs.readFileSync(p,'utf8');
const plan=JSON.parse(file('auditorias/PLAN_EJECUCION_TRANSVERSAL.json'));
const master=file('auditorias/ESTADO_ACTUAL.md');
const ids=new Set();
assert(plan.action==='CIUDADES_TRANSVERSAL','La acción vigente cambió sin migración documentada.');
assert(plan.steps?.length>0,'Faltan pasos en el plan transversal.');
assert(plan.current_step,'Falta el paso vigente.');
const steps=new Map(plan.steps.map(s=>[s.id,s]));
assert(steps.size===plan.steps.length,'Hay identificadores de pasos duplicados.');
for(const s of plan.steps){
 assert(s.id&&!ids.has(s.id),'Paso repetido o sin ID: '+s.id);ids.add(s.id);
 assert(s.title&&s.solution&&s.acceptance,'Paso sin solución o prueba de aceptación: '+s.id);
 assert(Array.isArray(s.issues)&&s.issues.length>0,'Paso sin incidencias: '+s.id);
 assert(Array.isArray(s.source_paths)&&s.source_paths.length>0,'Paso sin rutas afectadas: '+s.id);
 assert(['pendiente','en_curso','bloqueado','comprobado'].includes(s.status),'Estado inválido '+s.id);
 for(const dep of s.depends_on||[])assert(steps.has(dep),'Dependencia inexistente: '+s.id+' -> '+dep);
 if(s.status==='comprobado'){
  for(const dep of s.depends_on||[])assert(steps.get(dep).status==='comprobado','No se cierra '+s.id+' antes de '+dep);
  for(const k of ['unit','browser','live_services'])
   assert(s.verification?.[k]==='comprobado','Falta evidencia de '+k+' en '+s.id);
  for(const k of ['before','after','usd'])
   assert(s.consumption?.[k]!==undefined&&s.consumption?.[k]!=='sin_medir','Falta consumo '+k+' en '+s.id);
  assert(Array.isArray(s.evidence)&&s.evidence.length>0,'Falta evidencia referenciada de '+s.id);
 }
}
assert(steps.has(plan.current_step),'El paso vigente no existe.');
assert(steps.get(plan.current_step).status==='en_curso','El paso vigente debe ser el único en curso.');
assert(plan.steps.filter(s=>s.status==='en_curso').length===1,'Más de un paso en curso o ninguno.');
for(const issue of plan.issues_known||[])assert(plan.steps.some(s=>s.issues.includes(issue)),'Incidencia huérfana: '+issue);
assert(plan.last_intervention?.step_id===plan.current_step,'Última intervención fuera del paso activo.');
assert(plan.last_intervention?.next,'La intervención no indica próximo paso.');
assert(master.includes('MAPA_TRANSVERSAL_CIUDADES.md'),'El registro maestro perdió su mapa transversal.');
assert(fs.existsSync('auditorias/ARQUITECTURA_Y_CONTROL.md'),'Falta el contrato arquitectónico.');
function git(args){return cp.execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
let changes=[];
const base=process.env.GLD_AUDIT_BASE;
if(base){
 try{changes=git(['diff','--name-only',base+'...HEAD']).split('\n').filter(Boolean);}
 catch(_){changes=git(['diff','--name-only',base,'HEAD']).split('\n').filter(Boolean);}
}
const code=changes.filter(p=>p.startsWith('worker/')||p.startsWith('plataforma/'));
if(code.length){
 assert(changes.includes('auditorias/ESTADO_ACTUAL.md'),'Cambio de código sin actualizar el registro maestro.');
 assert(changes.includes('auditorias/PLAN_EJECUCION_TRANSVERSAL.json'),'Cambio de código sin actualizar la cola de acciones.');
 assert(code.every(p=>plan.source_scope.includes(p)),'Archivo fuera del mapa de la acción vigente: '+code.filter(p=>!plan.source_scope.includes(p)).join(', '));
 assert(code.filter(p=>/^worker\/worker\d+\.txt$/.test(p)).length<=1,'Se alteraron varios archivos Worker.');
 assert(plan.last_intervention?.source_paths?.some(p=>code.includes(p)),'La última intervención no registra los archivos intervenidos.');
}
console.log('PROTOCOLO PASS: pasos='+plan.steps.length+', incidencias='+plan.issues_known.length+
 ', vigente='+plan.current_step+', archivos_modificados='+code.length);
console.log('Nota: PASS controla registro y requisitos de cierre, NO certifica ejecución en navegador ni facturación.');
