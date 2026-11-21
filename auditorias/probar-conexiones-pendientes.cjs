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
 // Paso 2: cotejo de emisor dinámico y sustitución real de cargadores GH.
 // No prueba aparición temporal de filas anteriores durante el arranque.
 const source=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
 const login=source('plataforma/login.html');
 assert.match(login,/async function postJsonRaw143\s*\(url,\s*body\)/);
 const raw=login.slice(login.indexOf('async function postJsonRaw143('),login.indexOf('async function postJsonRaw143(')+550);
 assert.match(raw,/fetch\(url,\s*\{/);
 assert.match(raw,/method:\s*'POST'/);
 const wrapper=login.slice(login.indexOf('async function postJson(url,body)'),login.indexOf('async function postJsonRaw143('));
 assert.match(wrapper,/postJsonRaw143\(url,next\)/);
 assert.match(wrapper,/postJsonRaw143\(url,body\)/);
 // Once sitios concretos: seis rutas de publicación más Comercio, nunca rutas ajenas por un helper común.
 const expectedPostTargets={
  WORKER_ACTIVIDADES_URL:2,WORKER_PUBLICIDAD_URL:4,WORKER_EFEMERIDES_URL:1,
  WORKER_FARMACIAS_URL:1,WORKER_EVENTS_URL:1,WORKER_PROMOS_URL:1,WORKER_COMMERCE_URL:1
 };
 const foundPostTargets={};
 for(const m of login.matchAll(/\bpostJson\(\s*(WORKER_[A-Z_]+_URL)\b/g)){
  foundPostTargets[m[1]]=(foundPostTargets[m[1]]||0)+1;
 }
 assert.deepEqual(foundPostTargets,expectedPostTargets,'Cambiaron los emisores de postJson; revisar destinos del catálogo');
 for(const [variable,route] of Object.entries({
  WORKER_ACTIVIDADES_URL:'/actividades',WORKER_PUBLICIDAD_URL:'/publicidad',
  WORKER_EFEMERIDES_URL:'/efemerides',WORKER_FARMACIAS_URL:'/farmacias',
  WORKER_EVENTS_URL:'/events-new',WORKER_PROMOS_URL:'/promos',WORKER_COMMERCE_URL:'/commerce'
 })){
  assert(login.includes("const "+variable+" = WORKER_ORIGIN + '"+route+"'"),'Constante de destino cambió: '+variable);
 }
 console.log('PASO2_POSTJSON_EMISORES PASS 11_sitios 7_rutas_desambiguadas');
 // La URL es argumento del llamador, no endpoint fijo de postJsonRaw143.
 const admin=source('plataforma/administracion.html');
 const promoSrc=admin.indexOf('/plataforma/gh-promos.js');
 const publicitySrc=admin.indexOf('/plataforma/gh-publicidad.js');
 const listingSrc=admin.indexOf('/plataforma/gh-listados.js');
 assert(promoSrc>=0&&publicitySrc>promoSrc&&listingSrc>publicitySrc,'Orden de carga GH distinto al cotejado');
 const listings=source('plataforma/gh-listados.js');
 assert.match(listings,/ghPublicidadLoad101\s*=\s*\(\)\s*=>\s*load\('publicidad'\)/);
 assert.match(listings,/ghPublicidadPrepare101\s*=\s*\(\)\s*=>\s*prepare\('publicidad'\)/);
 assert.match(listings,/window\.ghPromosLoadV91\s*=\s*\(force=false\)\s*=>\s*load\('promos',false,force\)/);
 assert.match(listings,/window\.ghPromosPrepareV91\s*=\s*\(\)\s*=>\s*prepare\('promos'\)/);
 assert.match(listings,/ghAdminRequest_\('\/listados'/);
 const oldPromos=source('plataforma/gh-promos.js');
 const oldPublicity=source('plataforma/gh-publicidad.js');
 assert.match(oldPromos,/data-promo-action/);
 assert.match(oldPromos,/window\.ghPromosLoadV91\s*=\s*function/);
 assert.match(oldPublicity,/data-gh-pub/);
 assert.match(oldPublicity,/async function ghPublicidadLoad101\(/);
 // Inspección reproducible del ZIP vigente: no modifica ni regenera el catálogo.
 const archive=path.join(__dirname,'transversal','CATALOGO_MAESTRO.zip');
 const inspectPy=[
  'import json,zipfile,sys',
  'with zipfile.ZipFile(sys.argv[1]) as z:',
  ' print("PASO2_ZIP_MEMBERS",[(i.filename,i.file_size) for i in z.infolist()][:20])',
  ' for name in z.namelist():',
  '  if not name.lower().endswith(".json"): continue',
  '  try: payload=json.loads(z.read(name))',
  '  except Exception: continue',
  '  if not isinstance(payload,dict): continue',
  '  print("PASO2_JSON_SCHEMA",name,list(payload)[:35])',
  '  print("PASO2_JSON_COUNTS",{k:(len(v) if isinstance(v,(list,dict)) else v) for k,v in payload.items() if k in ("entries","equivalences","equivalencias","totals","historicalEquivalences","cotejoPaso2")})',
  '  meta=payload.get("cotejoPaso2",{})',
  '  print("PASO2_COTEJO_FIELDS",[(k,type(v).__name__,len(v) if isinstance(v,(list,dict)) else str(v)[:100]) for k,v in meta.items()])',
  '  prev=payload.get("previousEdition",{})',
  '  print("PASO2_PREVIOUS_FIELDS",[(k,type(v).__name__,len(v) if isinstance(v,(list,dict)) else str(v)[:100]) for k,v in prev.items()] if isinstance(prev,dict) else str(prev)[:500])',
  '  pairs=prev.get("units",{}) if isinstance(prev,dict) else {}',
  '  missing=[(k,v) for k,v in pairs.items() if v is None or (isinstance(v,dict) and any(x is None for x in v.values()))]',
  '  print("PASO2_19_EQUIVALENCIAS",json.dumps(missing[:30],ensure_ascii=False)[:12000])',
  '  print("PASO2_PREVIOUS_SAMPLES",json.dumps(list(pairs.items())[:3],ensure_ascii=False)[:1800])',
  '  for e in payload.get("entries",[]):',
  '   if e.get("id") in ("AUD-00490","AUD-00386","AUD-00001","AUD-00330","AUD-00331"):',
  '    print("PASO2_ENTRY_SAMPLE",json.dumps({k:v for k,v in e.items() if k in ("id","start","cotejoPaso2","network","data","status","historical","previousEdition")},ensure_ascii=False)[:4500])',
  '  for k,v in meta.items():',
  '   if any(w in k.lower() for w in ("generic","gener","histor","equiv","multi","pend")):',
  '    print("PASO2_FIELD_EXCERPT",k,json.dumps(v,ensure_ascii=False)[:1500])',
 ].join('\n');
 const inspection=cp.execFileSync('python3',['-c',inspectPy,archive],{encoding:'utf8'});
 console.log(inspection.slice(0,10000));
 console.log('PASO2_GH_SUSTITUCION PASS 4_exports_efectivos orden_de_scripts legados_preexistentes');
 console.log('PASO2_POSTJSONRAW143 PASS URL_del_llamador POST_no_destino_fijo');
 console.log('CONEXIONES_PENDIENTES PASS callback_objeto posicional default alias namespace rechazo_encadenado ambito_inaccesible objeto_ajeno');
}finally{fs.rmSync(root,{recursive:true,force:true});}
