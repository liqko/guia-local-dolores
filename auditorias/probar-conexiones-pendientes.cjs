#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {check}=require('./comprobar-recorridos-completos.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gld-conexiones-'));
try{
 fs.mkdirSync(path.join(root,'plataforma'));
 fs.writeFileSync(path.join(root,'plataforma/component.js'),`(function(api){
 function render({onChange}){const prev={};prev.onclick=()=>onChange();}
 function run(value,send){return send(value)}
 function fallback(value,open=()=>db.get('default')){return open(value)}
 function options(config){const reload=typeof config.reload==='function'?config.reload:null;if(reload)reload()}
 api.TEST_COMPONENT=Object.freeze({render,run,fallback,options});
 })(window);`);
 fs.writeFileSync(path.join(root,'plataforma/index.html'),`<script src='/plataforma/component.js'></script>
 <button onclick='invoke()'>Ir</button><button onclick='promises()'>Promesa</button><button onclick='illegal()'>Fuera de ámbito</button><button onclick='unrelated()'>Objeto ajeno</button>
 <script>
 var {backend}=(()=>{function backend({featureAllowed}){return featureAllowed()}return {backend}})();
 function provided(){return db.patch('predicate',{})}
 function featureAllowed(){return db.get('wrong-global')}
 function invoke(){backend({featureAllowed:provided});TEST_COMPONENT.render({onChange:()=>db.get('page')});TEST_COMPONENT.run({},()=>db.get('send'));TEST_COMPONENT.fallback({});TEST_COMPONENT.options({reload:()=>db.get('reload')});}
 function promises(){return new Promise((resolve,reject)=>{const req={};req.onerror=req.onblocked=()=>reject('error')})}
 function illegal(){return hidden()}
 (()=>{function hidden(){return db.get('inaccessible')}})();
 function unrelated(){const arbitrary={};arbitrary.render({onChange:()=>db.get('not_exported')})}
 </script>`);
 cp.execFileSync('git',['init','-q'],{cwd:root});cp.execFileSync('git',['add','plataforma'],{cwd:root});
 const run=cp.spawnSync(process.execPath,[path.join(__dirname,'arbol-estatico.cjs'),'--write'],{cwd:root,env:{...process.env,GLD_GPS_ROOT:root},encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(fs.readFileSync(path.join(root,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));check(r);
 const tree=r.trees.find(t=>t.action.handler==='invoke()');assert(tree);assert.equal(tree.counts.unresolved,0);assert.equal(tree.counts.missingHandlers,0);
 const page=r.trees.find(t=>t.action.kind==='event_property'&&t.action.receiver==='prev');assert(page?.nodes.some(n=>n.type==='data'&&n.key==='page'),'No sigue callback del evento');
 assert(!tree.nodes.some(n=>n.type==='data'&&n.key==='wrong-global'),'Confundió parámetro callback con función global homónima');
 for(const key of ['predicate','send','default','reload'])assert(tree.nodes.some(n=>n.type==='data'&&n.key===key),'No alcanza '+key);
 const onerrors=r.trees.filter(t=>t.action.kind==='event_property'&&['onerror','onblocked'].includes(t.action.event));assert.equal(onerrors.length,2);for(const t of onerrors){assert.equal(t.counts.missingHandlers,0);assert(t.nodes.some(n=>n.type==='promise_resolved'&&n.exportedFrom.settlement==='reject'));}
 const bad=r.trees.find(t=>t.action.handler==='illegal()');assert(bad.nodes.some(n=>n.type==='missing_handler'&&n.reason==='funcion_declarada_en_ambito_inaccesible'));assert(!bad.nodes.some(n=>n.type==='data'));
 const unrelated=r.trees.find(t=>t.action.handler==='unrelated()');assert(!unrelated.nodes.some(n=>n.type==='data'&&n.key==='not_exported'),'Conectó un método sólo por compartir nombre');
 console.log('CONEXIONES_PENDIENTES PASS callback_objeto posicional default alias namespace rechazo_encadenado ambito_inaccesible objeto_ajeno');
}finally{fs.rmSync(root,{recursive:true,force:true});}
