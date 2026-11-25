#!/usr/bin/env node
'use strict';
/*
 * Auditoría integral: puerta de integridad comprobable.
 * No certifica comportamiento dinámico; certifica inventario íntegro y que
 * ninguna afirmación de cierre use fuentes obsoletas u omita entradas detectadas.
 * Sin certificado completo => no se puede aprobar un análisis.
 */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const CERT='auditorias/transversal/COBERTURA_COMPROBADA.json';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const PATTERNS=[
 ['entrada_navegador',/\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(|\b(?:addEventListener|onclick|onsubmit)\b|\b(?:ghAdminRequest_|api\s*\()\b/i],
 ['entrada_worker',/\b(?:request\.method|request2\.method|url\.pathname|pathname|path)\s*(?:===?|\.startsWith\(|\.includes\(|\.match\()|\b(?:route|dispatch|fetch)\s*\(/i],
 ['efecto_datos',/\b(?:db|cache|kv|storage|firestore|env\.[A-Z_0-9]+)\s*\.\s*(?:get|put|set|patch|add|delete|list|query|commit|transaction|fetch|send|prepare|batch|run)\s*\(|\b(?:fetch|XMLHttpRequest)\s*\(/i],
 ['efecto_estado',/\b(?:localStorage|sessionStorage|indexedDB|caches)\s*\.|\b(?:postMessage|setItem|removeItem)\s*\(/i]
];
const sourceFile=p=>/^(worker|plataforma)\/.*\.(?:js|cjs|mjs|html|css|json|txt)$/.test(p);
function tracked(root){
 let o;
 try{o=cp.execFileSync('git',['ls-files','-z','--','worker','plataforma'],{cwd:root,encoding:'utf8'});}
 catch(e){throw Error('Sin inventario git de fuentes: '+e.message);}
 return o.split('\0').filter(sourceFile).filter(p=>fs.existsSync(path.join(root,p))).sort();
}
function scan(root=ROOT){
 const files=tracked(root), anchors=[];
 for(const p of files){
  const body=fs.readFileSync(path.join(root,p),'utf8'), lines=body.split('\n');
  for(let i=0;i<lines.length;i++){
   const code=lines[i].trim(); if(!code)continue;
   for(const [kind,re] of PATTERNS){
    if(re.test(code)){
     anchors.push({id:hash([p,i+1,kind,code].join('\0')),file:p,line:i+1,kind,
      code:code.slice(0,220)});
    }
   }
  }
 }
 return {schema:1,files:files.map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))})),
  anchors:anchors.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.kind.localeCompare(b.kind)),
  totals:{files:files.length,anchors:anchors.length}};
}
function validate(scanResult,certificate){
 assert(certificate&&certificate.schema===1,'Certificado ausente o versión inválida');
 assert(Array.isArray(certificate.files)&&Array.isArray(certificate.anchors),'Certificado sin lista de fuentes y conexiones');
 assert.deepEqual(certificate.files,scanResult.files,'Fuentes cambiadas u omitidas: regenerar y verificar el análisis');
 const expected=new Map(scanResult.anchors.map(a=>[a.id,a]));
 assert.equal(certificate.anchors.length,expected.size,'Cantidad de conexiones distinta del análisis automático');
 const found=new Set();
 for(const item of certificate.anchors){
  assert(item&&typeof item.id==='string','Conexión sin identificador');
  assert(!found.has(item.id),'Conexión duplicada: '+item.id);found.add(item.id);
  const base=expected.get(item.id);assert(base,'Conexión inventada u obsoleta: '+item.id);
  for(const k of ['file','line','kind'])assert.equal(item[k],base[k],'Ubicación incorrecta: '+item.id);
  assert(['comprobado','pendiente','no_resuelto'].includes(item.state),'Estado inválido: '+item.id);
  if(item.state==='comprobado'){
   assert(typeof item.trace==='string'&&item.trace.length>=8,'Sin traza identificada: '+item.id);
   assert(typeof item.proof==='string'&&item.proof.length>=8,'Sin prueba identificada: '+item.id);
  }
 }
 assert.equal(found.size,expected.size,'Conexiones omitidas');
 const blockers=certificate.anchors.filter(a=>a.state!=='comprobado');
 assert.equal(blockers.length,0,'Análisis incompleto: '+blockers.length+' conexiones pendientes/sin resolver');
 assert(Array.isArray(certificate.traces)&&certificate.traces.length>0,'Faltan trazas ejecutables');
 assert(Array.isArray(certificate.proofs)&&certificate.proofs.length>0,'Faltan pruebas ejecutables');
 const traces=new Map(certificate.traces.map(x=>[x.id,x]));
 const proofs=new Map(certificate.proofs.map(x=>[x.id,x]));
 for(const a of certificate.anchors){
  const trace=traces.get(a.trace);assert(trace&&Array.isArray(trace.chain)&&trace.chain.includes(a.id),'Traza ausente/no vinculada: '+a.id);
  const proof=proofs.get(a.proof);assert(proof&&proof.trace===trace.id,'Prueba ausente/no vinculada: '+a.id);
 }
 // Nunca se acepta una prueba de texto libre: se ejecuta el comando en CI
 // y se compara resultado + hash con la evidencia declarada.
 for(const proof of certificate.proofs){
  assert(proof&&typeof proof.id==='string','Prueba sin ID');
  assert(typeof proof.script==='string'&&/^auditorias\/pruebas\/[\w/-]+\.cjs$/.test(proof.script),'Prueba fuera de scripts de auditoría');
  const absolute=path.join(ROOT,proof.script);
  assert(fs.existsSync(absolute),'No existe el script de prueba '+proof.script);
  assert.equal(hash(fs.readFileSync(absolute)),proof.script_sha256,'Script de prueba modificado');
  assert.equal(proof.expected_exit,0,'Una prueba fallida no acredita cierre');
  const run=cp.spawnSync(process.execPath,[absolute],{cwd:ROOT,encoding:'utf8',timeout:120000});
  assert.equal(run.status,0,'Prueba real falló: '+proof.id+' '+(run.stderr||'').slice(0,150));
  assert.equal(hash(run.stdout||''),proof.stdout_sha256,'Resultado de prueba distinto: '+proof.id);
 }
 return {files:scanResult.files.length,anchors:expected.size,traces:traces.size,proofs:proofs.size};
}
function claim(){
 const p=JSON.parse(fs.readFileSync(path.join(ROOT,'auditorias/PLAN_EJECUCION_TRANSVERSAL.json'),'utf8'));
 return p.status==='comprobado'||p.analysis_status==='comprobado'||(p.steps||[]).some(s=>s.status==='comprobado');
}
function selfTest(){
 const sample={schema:1,files:[{path:'worker/x.js',sha256:'abc'}],
  anchors:[{id:'a',file:'worker/x.js',line:1,kind:'entrada_worker',code:'route()'}]};
 const cert={schema:1,files:sample.files.map(x=>({...x})),anchors:[{id:'a',file:'worker/x.js',line:1,kind:'entrada_worker',state:'pendiente'}],traces:[],proofs:[]};
 assert.throws(()=>validate(sample,cert),/incompleto/);
 assert.throws(()=>validate(sample,{...cert,files:[]}),/Fuentes cambiadas/);
 assert.throws(()=>validate(sample,{...cert,anchors:[]}),/Cantidad de conexiones/);
 assert.throws(()=>validate(sample,{...cert,anchors:[{...cert.anchors[0],state:'comprobado',trace:'inventada',proof:'inventada'}]}),/Faltan trazas/);
 assert.throws(()=>validate(sample,{...cert,anchors:[{...cert.anchors[0],id:'falsa'}]}),/inventada/);
 console.log('AUTO-TEST PASS: pendientes, fuentes obsoletas, omisiones, trazas falsas y conexiones inventadas bloqueadas');
}
function main(){
 const mode=process.argv[2]||'--check';
 if(mode==='--self-test')return selfTest();
 const current=scan();
 if(mode==='--scan'){
  console.log(JSON.stringify({status:'INVENTARIO_NO_CERTIFICADO',...current.totals,classes:Object.fromEntries(PATTERNS.map(([k])=>[k,current.anchors.filter(a=>a.kind===k).length]))},null,2));
  return;
 }
 assert.equal(mode,'--check','Modo desconocido');
 if(!fs.existsSync(path.join(ROOT,CERT))){
  if(claim())throw Error('CIERRE BLOQUEADO: no existe '+CERT);
  console.log('INCOMPLETO SIN CIERRE: '+current.totals.files+' archivos, '+current.totals.anchors+' conexiones automáticas; falta certificado verificable.');
  return;
 }
 const cert=JSON.parse(fs.readFileSync(path.join(ROOT,CERT),'utf8'));
 try{const ok=validate(current,cert);console.log('INTEGRIDAD COMPROBADA '+JSON.stringify(ok));}
 catch(e){if(claim())throw e;console.log('INCOMPLETO SIN CIERRE: '+e.message);}
}
if(require.main===module){
 try{main();}catch(e){console.error('BLOQUEO DE CIERRE: '+e.message);process.exitCode=1;}
}
module.exports={scan,validate,selfTest};
