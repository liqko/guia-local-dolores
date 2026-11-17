#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const multiset=items=>{const m=new Map();for(const x of items){const k=JSON.stringify(x);m.set(k,(m.get(k)||0)+1);}return [...m].sort(([a],[b])=>a.localeCompare(b));};
function check(report){
 assert(report.functionGraph?.length,'Falta grafo de funciones y llamadas fuente');
 const graph=new Map(report.functionGraph.map(f=>[f.id,f]));
 assert.equal(graph.size,report.functionGraph.length,'ID de función duplicado');
 let calls=0,refs=0;
 for(const tree of report.trees){
  const label=tree.action.file+':'+tree.action.line;
  assert(!tree.nodes.some(n=>n.type==='limit'),label+': recorrido truncado');
  const bodies=tree.nodes.filter(n=>n.type==='function'),ids=new Set(bodies.map(n=>n.id));
  assert.equal(ids.size,bodies.length,label+': cuerpo expandido más de una vez');
  const guarded=tree.nodes.filter(n=>n.type==='guarded_call');
  const edges=new Set(tree.nodes.filter(n=>n.type==='edge').map(n=>[n.from,n.to,n.at].join('|')));
  const actual=multiset(guarded.map(n=>[n.from,n.callId,n.file,n.line,n.method,n.kind,n.guards]));
  const expected=multiset(bodies.flatMap(n=>{
   const f=graph.get(n.id);assert(f,label+': función fuera del grafo');
   return f.calls.map(c=>[f.id,c.id,c.file,c.line,c.method,c.kind,c.guards]);
  }));
  assert.deepEqual(actual,expected,label+': llamadas o condiciones omitidas');
  const expectedEffects=multiset(bodies.flatMap(n=>graph.get(n.id).calls.filter(c=>['http','data'].includes(c.kind)).map(c=>[c.id,c.kind,c.file,c.line])));
  const actualEffects=multiset(tree.nodes.filter(n=>['http','data'].includes(n.type)).map(n=>[n.callId,n.type,n.file,n.line]));
  assert.deepEqual(actualEffects,expectedEffects,label+': operación de datos o red omitida');
  const terminalKey=(id,n)=>[id,n.kind||n.type,n.file,n.line,n.expression,n.guards];
  const expectedEnds=multiset(bodies.flatMap(n=>graph.get(n.id).terminals.map(t=>terminalKey(n.id,t))));
  const terminalKinds=new Set(report.functionGraph.flatMap(f=>f.terminals.map(t=>t.kind)));
  const actualEnds=multiset(tree.nodes.filter(n=>terminalKinds.has(n.type)).map(n=>terminalKey(n.from,n)));
  assert.deepEqual(actualEnds,expectedEnds,label+': retornos o excepciones omitidos');
  for(const n of tree.nodes.filter(n=>['reference','cycle'].includes(n.type))){assert(ids.has(n.to),label+': referencia sin cuerpo destino');refs++;}
  for(const f of bodies.map(n=>graph.get(n.id)))for(const c of f.calls){
   if(['data','http'].includes(c.kind)||/^promise_resolver_/.test(c.resolution))continue;
   const targets=c.to?[c.to]:c.alternatives;
   for(const to of targets){assert(ids.has(to),label+': destino sin expandir '+to);assert(edges.has([f.id,to,c.file+':'+c.line].join('|')),label+': arista omitida');}
  }
  calls+=guarded.length;
 }
 return {trees:report.trees.length,guardedCalls: calls,sharedReferencesAndCycles:refs,truncatedTrees:0};
}
if(require.main===module){
 const report=JSON.parse(fs.readFileSync(process.argv.slice(2).find(x=>!x.startsWith('--'))||'auditorias/transversal/ARBOL_ACCIONES.json','utf8'));
 const result=check(report);
 if(process.argv.includes('--self-test')){
  const t=report.trees.find(t=>t.nodes.some(n=>n.type==='guarded_call'));
  const i=t.nodes.findIndex(n=>n.type==='guarded_call'),removed=t.nodes.splice(i,1)[0];
  assert.throws(()=>check(report),/llamadas o condiciones omitidas/);t.nodes.splice(i,0,removed);
  const ref=report.trees.flatMap(t=>t.nodes).find(n=>n.type==='reference');
  if(ref){const to=ref.to;ref.to='destino_inexistente';assert.throws(()=>check(report),/referencia sin cuerpo destino/);ref.to=to;}
  const dt=report.trees.find(t=>t.nodes.some(n=>n.type==='data'));
  const di=dt.nodes.findIndex(n=>n.type==='data'),dn=dt.nodes.splice(di,1)[0];
  assert.throws(()=>check(report),/operación de datos o red omitida/);dt.nodes.splice(di,0,dn);
  console.log('RECORRIDOS_MUTANTES_RECHAZADOS PASS llamada_eliminada referencia_rota dato_eliminado');
 }
 console.log('RECORRIDOS_COMPLETOS PASS '+JSON.stringify(result));
}
module.exports={check};
