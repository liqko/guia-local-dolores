#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gld-arbol-'));
function run(args,env={}){return cp.spawnSync(process.execPath,[path.join(__dirname,'arbol-estatico.cjs'),...args],{cwd:root,env:{...process.env,GLD_GPS_ROOT:root,...env},encoding:'utf8'});}
try{
 fs.mkdirSync(path.join(root,'worker'),{recursive:true});
 fs.mkdirSync(path.join(root,'plataforma'),{recursive:true});
 fs.writeFileSync(path.join(root,'plataforma/index.html'),[
  '<button id="alta" onclick="guardarCiudad()">Guardar ciudad</button>',
  '<button id="sinruta" onclick="noExiste()">Rota</button>',
  '<button id="obj" onclick="accionObjeto()">Objeto</button>',
  '<script>const obj={run(){return fetch("/superadmin/cities/create")}};function accionObjeto(){return obj.run()}</script>',
  '<script>function guardarCiudad(){return enviarCiudad()}</script>'
 ].join('\n'));
 fs.writeFileSync(path.join(root,'plataforma/enviar.js'),"function enviarCiudad(){return fetch('/superadmin/cities/create')}\n");
 fs.writeFileSync(path.join(root,'worker/worker206.txt'),"async function alta(db){await db.patch('ciudades','dolores',{});return 'ok';}\nif(path==='/superadmin/cities/create' && request.method==='GET') return alta(db);\n");
 // Shared function via HTML script src must resolve to local imported file.
 fs.appendFileSync(path.join(root,'plataforma/index.html'),"\n<script src=\"/plataforma/enviar.js\"></script>\n");
 cp.execFileSync('git',['init','-q'],{cwd:root});cp.execFileSync('git',['add','worker','plataforma'],{cwd:root});
 let r=run(['--write']);assert.equal(r.status,0,r.stderr);
 const json=JSON.parse(fs.readFileSync(path.join(root,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 assert.equal(json.totals.files,3);
 const good=json.trees.find(x=>x.action.handler==='guardarCiudad()');
 assert(good,'No encontró botón de guardar');
 assert(good.nodes.some(n=>n.type==='function'&&n.name==='guardarCiudad'),'No enlazó el manejador');
 assert(good.nodes.some(n=>n.type==='function'&&n.name==='enviarCiudad'),'No recorrió función importada');
 assert(good.nodes.some(n=>n.type==='http'&&n.target==='/superadmin/cities/create'),'No detectó solicitud');
 assert(good.nodes.some(n=>n.type==='backend_candidate'&&n.handler==='alta'),'No enlazó la ruta HTTP con el manejador del Worker');
 assert(good.nodes.some(n=>n.type==='data'&&n.operation==='patch'),'No recorrió la operación de persistencia');
 const objectTree=json.trees.find(x=>x.action.handler==='accionObjeto()');
 assert(objectTree?.nodes.some(n=>n.type==='edge'&&n.resolution==='static_object_method'),'No siguió método del objeto local');
 const bad=json.trees.find(x=>x.action.handler==='noExiste()');
 assert(bad?.counts.unresolved,'No marcó botón sin función');
 r=run(['--check']);assert.equal(r.status,0,r.stderr);
 fs.appendFileSync(path.join(root,'plataforma/enviar.js'),'\nconst cambiado=true;\n');
 r=run(['--check']);assert.notEqual(r.status,0,'No rechazó fuente modificada sin regenerar');
 console.log('ÁRBOL REGRESSION PASS: botón→función→función importada→red; botón sin manejador; rechazo de árbol obsoleto');
}finally{fs.rmSync(root,{recursive:true,force:true});}
