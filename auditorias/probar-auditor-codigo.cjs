#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gld-auditor-'));
try{
 fs.mkdirSync(path.join(dir,'worker'));fs.mkdirSync(path.join(dir,'plataforma'));
 fs.writeFileSync(path.join(dir,'worker/worker206.txt'),[
 "const ADMIN_KEY='territorio:admin:v1', PUBLIC_KEY='territorio:public:v1';",
 "async function actualizar(cache){",
 " const x=await cache.get(PUBLIC_KEY);",
 " const y=await cache.get(PUBLIC_KEY);",
 " await Promise.all([cache.put(ADMIN_KEY,x),cache.put(PUBLIC_KEY,y)]);",
 "}",
 "function actualizar(cache){return cache.get(PUBLIC_KEY);}",
 "function route(req){return '/superadmin/cities/create';}"
 ].join('\n'));
 fs.writeFileSync(path.join(dir,'plataforma/app.js'),"function click(){return fetch('/superadmin/cities/create')}\n");
 cp.execFileSync('git',['init','-q'],{cwd:dir});
 cp.execFileSync('git',['add','worker','plataforma'],{cwd:dir});
 const target=path.join(__dirname,'auditar-codigo.cjs');
 function run(args){return cp.spawnSync(process.execPath,[target,...args],{env:{...process.env,GLD_GPS_ROOT:dir},cwd:dir,encoding:'utf8'});}
 let r=run(['--write']);assert.equal(r.status,0,r.stderr);
 const report=JSON.parse(fs.readFileSync(path.join(dir,'auditorias/transversal/AUDITORIA_AUTOMATICA.json'),'utf8'));
 const rules=new Set(report.issues.map(i=>i.rule));
 assert(rules.has('escrituras_acopladas'),'No detecta los dos catálogos escritos a la vez');
 assert(rules.has('lecturas_repetidas_candidatas'),'No detecta lecturas repetidas');
 assert(rules.has('funciones_repetidas_candidatas'),'No detecta funciones duplicadas');
 assert(report.catalogs['territorio:public:v1'].readers.length>=2,'No rastrea lectores');
 r=run(['--check']);assert.equal(r.status,0,r.stderr);
 fs.appendFileSync(path.join(dir,'plataforma/app.js'),'\nconst modificado=true;\n');
 r=run(['--check']);assert.notEqual(r.status,0,'Aceptó un informe obsoleto');
 console.log('AUDITOR REGRESSION PASS: doble catálogo, lecturas repetidas, función duplicada, consumidores y rechazo a fuente cambiada');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
