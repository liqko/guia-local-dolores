#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gld-gps-'));
const script=path.join(__dirname,'generar-mapa-gps.cjs');
function run(args,ok=true){const r=cp.spawnSync(process.execPath,[script,...args],{cwd:root,env:{...process.env,GLD_GPS_ROOT:root},encoding:'utf8'});if(ok)assert.equal(r.status,0,r.stderr);else assert.notEqual(r.status,0,'El control debió rechazar el archivo alterado');return r;}
try{
 fs.mkdirSync(path.join(root,'worker'));fs.mkdirSync(path.join(root,'plataforma'));
 const worker=path.join(root,'worker/worker206.txt'),ui=path.join(root,'plataforma/app.js');
 fs.writeFileSync(worker,"function route(req){return fetch('/superadmin/territory/cities');}\nroute({});\n");
 fs.writeFileSync(ui,"function onClick(){fetch('/superadmin/territory/cities');fetch('/'+window.name);}\ndocument.addEventListener('click',onClick);\n");
 cp.execFileSync('git',['init','-q'],{cwd:root});cp.execFileSync('git',['add','worker','plataforma'],{cwd:root});
 run(['--write']);run(['--test']);run(['--check']);
 const output=path.join(root,'auditorias/transversal/MAPA_GPS_GENERADO.json');
 const graph=JSON.parse(fs.readFileSync(output));
 assert.equal(graph.stats.files,2);assert.ok(graph.stats.sharedRoutes>=1,'No detectó ruta compartida');
 assert.ok(graph.stats.unresolved>=1,'No marcó la ruta dinámica');
 fs.appendFileSync(output,'\nEVIDENCIA_FALSA');run(['--check'],false);
 run(['--write']);fs.appendFileSync(ui,'\nconst changed=true;\n');run(['--check'],false);
 console.log('GPS REGRESSION PASS: ruta compartida, ruta dinámica, mapa falsificado y fuente modificada');
}finally{fs.rmSync(root,{recursive:true,force:true});}
