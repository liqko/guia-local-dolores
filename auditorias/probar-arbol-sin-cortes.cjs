#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {check}=require('./comprobar-recorridos-completos.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gld-sin-cortes-'));
try{
 fs.mkdirSync(path.join(root,'plataforma'));
 const lines=['<button onclick="deep0()">Profundo</button>','<button onclick="wide()">Ancho</button>','<button onclick="diamond()">Compartido</button>','<button onclick="cycleA()">Ciclo</button>','<script>'];
 for(let i=0;i<1600;i++)lines.push('function deep'+i+'(){return '+(i===1599?'db.get("fin-profundo")':'deep'+(i+1)+'()')+'}');
 lines.push('function wide(){');for(let i=0;i<1500;i++)lines.push('db.get("ancho-'+i+'");');lines.push('return db.patch("fin-ancho",{});}');
 lines.push('function diamond(){if(flag)left();else right();shared();}','function left(){return shared()}','function right(){return shared()}','function shared(){return db.get("compartido")}','function cycleA(){db.get("a");return cycleB()}','function cycleB(){db.get("b");return cycleA()}','</script>');
 fs.writeFileSync(path.join(root,'plataforma/index.html'),lines.join('\n'));
 cp.execFileSync('git',['init','-q'],{cwd:root});cp.execFileSync('git',['add','plataforma'],{cwd:root});
 const run=cp.spawnSync(process.execPath,[path.join(__dirname,'arbol-estatico.cjs'),'--write'],{cwd:root,env:{...process.env,GLD_GPS_ROOT:root},encoding:'utf8',timeout:90000});
 assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(fs.readFileSync(path.join(root,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 check(r);
 const tree=h=>r.trees.find(t=>t.action.handler===h);
 assert.equal(tree('deep0()').counts.functions,1600);
 assert(tree('deep0()').nodes.some(n=>n.type==='data'&&n.key==='fin-profundo'));
 assert.equal(tree('wide()').counts.data,1501);
 assert(tree('wide()').nodes.some(n=>n.type==='data'&&n.key==='fin-ancho'));
 const shared=tree('diamond()');assert.equal(shared.nodes.filter(n=>n.type==='function'&&n.name==='shared').length,1);assert.equal(shared.nodes.filter(n=>n.type==='reference').length,2);assert.equal(shared.counts.cycles,0);
 assert(shared.nodes.some(n=>n.type==='guarded_call'&&n.guards.includes('flag')));assert(shared.nodes.some(n=>n.type==='guarded_call'&&n.guards.some(g=>g.includes('NOT'))));
 assert.equal(tree('cycleA()').counts.cycles,1);assert.equal(tree('cycleA()').counts.data,2);
 console.log('SIN_CORTES PASS 1600_funciones 1501_operaciones ramas_compartidas ciclo_real');
}finally{fs.rmSync(root,{recursive:true,force:true});}
