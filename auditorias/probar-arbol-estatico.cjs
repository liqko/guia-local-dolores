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
  '<button id="global" onclick="usarGlobal()">Global inicializado</button>',
  '<script>function initGlobal(){window.gldTestGlobal=()=>fetch("/superadmin/cities/create")}initGlobal()</script>',
  '<script src="/plataforma/externo.js"></script>',
  '<button id="sinruta" onclick="noExiste()">Rota</button>',
  '<button id="nativo" onclick="document.getElementById(\'alta\').click()">Nativo</button>',
  '<button id="compuesto" onclick="event.stopPropagation();guardarCiudad()">Compuesto</button>',
  '<button id="iife" onclick="accionIife()">IIFE</button>',
  '<button id="ramas" onclick="accionRamas(true)">Ramas</button>',
  '<button id="callback" onclick="entrarCallback()">Callback</button>',
  '<button id="routebad" onclick="rutaSinWorker()">Ruta ausente</button>',
  '<button id="export" onclick="aliasExport()">Exportado</button>',
  '<script src="/plataforma/exports.js"></script>',
  '<script>function rutaSinWorker(){return fetch("/api/ruta-que-no-existe")}</script>',
  '<script>function aceptar({load}){return load()}function entrarCallback(){return aceptar({load:()=>fetch("/superadmin/cities/create")})}</script>',
  '<script>function accionRamas(flag){if(flag)return enviarCiudad();else throw Error("sin permiso")}</script>',
  '<script>function accionIife(){return (function(){return guardarCiudad()})()}</script>',
  '<button id="obj" onclick="accionObjeto()">Objeto</button>',
  '<button id="accion" onclick="hacerConsulta()">Consultar</button>',
  '<button id="city" onclick="crearTerritorio(\'ciudad\')">Crear ciudad</button>',
  '<button id="wrapper" onclick="usarWrapper()">Wrapper</button>',
  '<button id="adminwrapper" onclick="buscarAdmin()">Buscar admin</button>',
  '<script>const API="https://login.test/superadmin";function ghAdminRequest_(path){return fetch(API+path)}function buscarAdmin(){return ghAdminRequest_("/subscribers/search")}</script>',
  '<button id="dyn" onclick="dinamica()">Dinámica</button>',
  '<script>function dinamica(){return fetch("/superadmin/advertisers/"+encodeURIComponent(id)+"/panel-access")}</script>',
  '<script>const ORIGIN="https://login.test";function wrapper(path){return fetch(ORIGIN+path)} function usarWrapper(){return wrapper("/superadmin/cities/create")}</script>',
  '<script>function crearTerritorio(tipo){const spec={pais:{path:"countries/create"},ciudad:{path:"cities/create"}}[tipo];return fetch("https://login.test"+"/superadmin/"+spec.path,{method:"POST"})}</script>',
  '<script>const API="https://example.test/superadmin";async function api(action){const routes={buscar:"/subscribers/search"};return routes[action]}function hacerConsulta(){return api("buscar")}</script>',
  '<script>document.addEventListener("click",()=>{return guardarCiudad()})</script>',
  '<script>function dosCallbacks(){const run=()=>{return fetch("/superadmin/cities/create")};return [1].forEach(x=>x&&run())}document.addEventListener("change",()=>{dosCallbacks(); [1].forEach(x=>dosCallbacks())})</script>',
  '<script>const obj={run(){return fetch("/superadmin/cities/create")}};function accionObjeto(){return obj.run()}</script>',
  '<script>function guardarCiudad(){return enviarCiudad()}</script>'
 ].join('\n'));
 fs.writeFileSync(path.join(root,'plataforma/exports.js'),"(function(){window.realExport=function(){return fetch('/superadmin/cities/create')};window.aliasExport=window.realExport})()\n");
 fs.writeFileSync(path.join(root,'plataforma/enviar.js'),"function enviarCiudad(){return fetch('/superadmin/cities/create')}\n");
 fs.writeFileSync(path.join(root,'plataforma/externo.js'),"function usarGlobal(){return window.gldTestGlobal()}\n");
 fs.writeFileSync(path.join(root,'worker/worker206.txt'),[
 "async function alta(db){await db.patch('ciudades','dolores',{});return 'ok';}",
 "if(path==='/superadmin/cities/create' && request.method==='GET') return alta(db);",
 "if(path==='/superadmin/cities/create' && request.method==='POST') return alta(db);",
 "if(path==='/superadmin/subscribers/search')return alta(db);",
 "let match=path.match(/^\\/superadmin\\/advertisers\\/([^/]+)\\/panel-access$/),other=path.match(/^\\/superadmin\\/subscribers\\/([^/]+)\\/reset-access$/); if(match)return alta(db);"
 ].join('\n'));
 // Shared function via HTML script src must resolve to local imported file.
 fs.appendFileSync(path.join(root,'plataforma/index.html'),"\n<script src=\"/plataforma/enviar.js\"></script>\n");
 cp.execFileSync('git',['init','-q'],{cwd:root});cp.execFileSync('git',['add','worker','plataforma'],{cwd:root});
 let r=run(['--write']);assert.equal(r.status,0,r.stderr);
 const json=JSON.parse(fs.readFileSync(path.join(root,'auditorias/transversal/ARBOL_ACCIONES.json'),'utf8'));
 assert.equal(json.totals.files,5);
 const globalTree=json.trees.find(x=>x.action.handler==='usarGlobal()');
 assert(globalTree?.nodes.some(n=>n.type==='edge'&&n.resolution==='conditional_global_assignment'),'No siguió asignación condicional window desde script contenedor');
 const good=json.trees.find(x=>x.action.handler==='guardarCiudad()');
 assert(good,'No encontró botón de guardar');
 assert(good.nodes.some(n=>n.type==='function'&&n.name==='guardarCiudad'),'No enlazó el manejador');
 assert(good.nodes.some(n=>n.type==='function'&&n.name==='enviarCiudad'),'No recorrió función importada');
 assert(good.nodes.some(n=>n.type==='http'&&n.target==='/superadmin/cities/create'),'No detectó solicitud');
 assert(good.nodes.some(n=>n.type==='backend_candidate'&&n.handler==='alta'),'No enlazó la ruta HTTP con el manejador del Worker');
 assert(good.nodes.some(n=>n.type==='data'&&n.operation==='patch'),'No recorrió la operación de persistencia');
 const exported=json.trees.find(x=>x.action.handler==='aliasExport()');
 assert(exported?.nodes.some(n=>n.type==='function'&&n.name==='window.realExport'),'No siguió exportación global alias');
 const brokenRoute=json.trees.find(x=>x.action.handler==='rutaSinWorker()');
 assert(brokenRoute?.counts.possibleMissingRoutes,'No avisó de ruta sin despacho Worker identificado');
 const cbTree=json.trees.find(x=>x.action.handler==='entrarCallback()');
 assert(cbTree?.nodes.some(n=>n.type==='edge'&&n.resolution==='destructured_parameter_callback'),'No conectó callback desestructurado con quien lo pasó');
 assert(cbTree?.nodes.some(n=>n.type==='http'),'No siguió efecto HTTP del callback');
 const branchTree=json.trees.find(x=>x.action.handler==='accionRamas(true)');
 assert(branchTree?.nodes.some(n=>n.type==='return'&&n.guards.some(g=>g==='flag')),'No registró retorno de rama verdadera');
 assert(branchTree?.nodes.some(n=>n.type==='throw'&&n.guards.some(g=>g.includes('NOT'))),'No registró error de rama falsa');
 const iifeTree=json.trees.find(x=>x.action.handler==='accionIife()');
 assert(iifeTree?.nodes.some(n=>n.type==='edge'&&['immediate_callback','immediate_callback_ast'].includes(n.resolution)),'No siguio funcion inmediatamente invocada');
 const cityTree=json.trees.find(x=>x.action.handler.includes('crearTerritorio'));
 assert(cityTree?.nodes.some(n=>n.type==='backend_candidate'&&n.handler==='alta'),'No conectó spec.path con alta Worker');
 assert(cityTree?.nodes.some(n=>n.type==='data'&&n.operation==='patch'),'No siguió la escritura del alta territorial');
 const dynTree=json.trees.find(x=>x.action.handler==='dinamica()');
 assert(dynTree?.nodes.some(n=>n.type==='http'&&n.worker?.some(w=>w.pattern?.includes('panel-access'))),'No enlazó la ruta dinámica con el patrón del Worker');
 assert(dynTree.nodes.some(n=>n.type==='http'&&n.worker?.some(w=>w.pattern?.includes('panel-access')&&w.file==='worker/worker206.txt')),'No reconoció un patrón de ruta si hay dos expresiones regulares en la misma línea');
 const adminTree=json.trees.find(x=>x.action.handler==='buscarAdmin()');
 assert(adminTree?.nodes.some(n=>n.type==='http'&&n.candidates?.includes('/superadmin/subscribers/search')),'No agregó el origen /superadmin a una solicitud relativa');
 const wrapperTree=json.trees.find(x=>x.action.handler==='usarWrapper()');
 assert(wrapperTree?.nodes.some(n=>n.type==='http'&&n.candidates?.includes('/superadmin/cities/create')),'No resolvió dirección del wrapper desde el parámetro de su llamador');
 const apiTree=json.trees.find(x=>x.action.handler==='hacerConsulta()');
 assert(apiTree?.nodes.some(n=>n.type==='http'&&n.candidates?.includes('/superadmin/subscribers/search')),'No resolvió API simbólica por su tabla de rutas');
 const listenerTree=json.trees.find(x=>x.action.kind==='listener'&&x.action.handler.startsWith('callback@'));
 assert(listenerTree?.nodes.some(n=>n.type==='function'&&n.name.startsWith('callback@')),'No recorrió callback directamente desde evento');
 const sameLine=json.trees.find(x=>x.action.kind==='listener'&&x.action.label==='change');
 assert(sameLine?.nodes.some(n=>n.type==='function'&&n.name==='dosCallbacks'),'No sigue callback anidado cuando hay múltiples funciones en una línea');
 const objectTree=json.trees.find(x=>x.action.handler==='accionObjeto()');
 assert(objectTree?.nodes.some(n=>n.type==='edge'&&n.resolution==='static_object_method'),'No siguió método del objeto local');
 const composite=json.trees.find(x=>x.action.handler.includes('event.stopPropagation'));
 assert(composite?.nodes.some(n=>n.type==='function'&&n.name==='guardarCiudad'),'No siguio llamadas del manejador compuesto');
 const native=json.trees.find(x=>x.action.handler.includes('getElementById'));
 assert(native&&!native.counts.missingHandlers,'Confundio funcion del navegador con ausencia de codigo');
 const bad=json.trees.find(x=>x.action.handler==='noExiste()');
 assert(bad?.counts.missingHandlers,'No marcó botón sin función en fuentes rastreadas');
 r=run(['--check']);assert.equal(r.status,0,r.stderr);
 fs.appendFileSync(path.join(root,'plataforma/enviar.js'),'\nconst cambiado=true;\n');
 r=run(['--check']);assert.notEqual(r.status,0,'No rechazó fuente modificada sin regenerar');
 console.log('ÁRBOL REGRESSION PASS: botón→función→función importada→red; botón sin manejador; rechazo de árbol obsoleto');
}finally{fs.rmSync(root,{recursive:true,force:true});}
