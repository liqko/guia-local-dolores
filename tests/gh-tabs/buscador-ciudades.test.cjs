const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.GLD_JSDOM_MODULE||'jsdom');
const html=process.env.GLD_CITY_BASELINE?require('node:child_process').execFileSync('git',['show','origin/main:plataforma/administracion.html'],{encoding:'utf8'}):fs.readFileSync('plataforma/administracion.html','utf8');
const start=html.indexOf('<div class="cfgpane active" data-cfgpane="territorio"'),end=html.indexOf('<div class="cfgpane hidden"',start);
const markup=html.slice(start,end),styles=html.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
const functions=html.slice(html.indexOf('const GH_CITY_EDIT_PENDING='),html.indexOf('async function ghGuardarCambioCiudad'));
const listeners=html.slice(html.indexOf("document.getElementById('ciuQ').addEventListener"),html.indexOf("document.getElementById('ciuSelect').addEventListener"));
const countries=[{pais_id:'AR',nombre:'Argentina'}],provinces=[{provincia_id:'BA',nombre:'Buenos Aires'},{provincia_id:'CO',nombre:'Córdoba'}];
const cities=[{ciudad_id:'DOL',nombre:'Dolores',pais_id:'AR',provincia_id:'BA',activa:true},{ciudad_id:'DOL2',nombre:'Dolores',pais_id:'AR',provincia_id:'CO',activa:true},{ciudad_id:'CHA',nombre:'Chascomús',pais_id:'AR',provincia_id:'BA',activa:false}];
function setup(t,rows=cities,role='SUPERADMIN_PRINCIPAL'){
 const dom=new JSDOM('<!doctype html><style>'+styles+'</style>'+markup,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://fixture.invalid/'});t.after(()=>dom.window.close());const w=dom.window,calls=[];
 Object.assign(w,{GH_CITIES:structuredClone(rows),GH_COUNTRIES:countries,GH_PROVINCES:provinces,GH_ADMIN_ACCESS:{rol:role},ghNorm:v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])),informarAltura(){},fetch(...args){calls.push(args);throw Error('Unexpected network');}});
 w.eval(functions+'\n'+listeners);w.ghRenderCiudades();
 return {w,doc:w.document,calls,search(value){const q=w.document.getElementById('ciuQ');q.value=value;q.dispatchEvent(new w.Event('input',{bubbles:true}));},results(){return [...w.document.querySelectorAll('#ciuResultados button')];}};
}
test('escribir muestra resultados visibles sin abrir el selector ni seleccionar una ciudad',t=>{
 const h=setup(t);h.search('Dolores');assert.equal(h.results().length,2);assert.equal(h.doc.getElementById('ciuResultados').hidden,false);assert.notEqual(h.w.getComputedStyle(h.doc.getElementById('ciuResultados')).display,'none');assert.equal(h.w.getComputedStyle(h.doc.getElementById('ciuSelect')).display,'none');assert.equal(h.doc.getElementById('ciuSelect').value,'');assert.match(h.results()[0].textContent,/Buenos Aires/);assert.match(h.results()[1].textContent,/Córdoba/);assert.equal(h.calls.length,0);
});
test('búsqueda parcial sin distinguir mayúsculas ni acentos conserva ciudades desactivadas',t=>{
 const h=setup(t);h.search('CHASCO');assert.equal(h.results().length,1);assert.match(h.results()[0].textContent,/Chascomús.*Desactivada/);assert.equal(h.calls.length,0);
});
test('pulsar una coincidencia abre su ficha correcta sin consultar al servidor',t=>{
 const h=setup(t);h.search('dol');h.results()[1].click();assert.equal(h.doc.getElementById('ciuSelect').value,'DOL2');assert.match(h.doc.getElementById('ciudadDetalle').textContent,/Córdoba/);assert(h.doc.getElementById('ghCiudadEditar'));assert(h.doc.getElementById('ghCiudadEliminar'));assert.equal(h.calls.length,0);
});
test('cambiar la búsqueda descarta una ficha que ya no coincide; sin resultados muestra un aviso',t=>{
 const h=setup(t);h.search('Dolores');h.results()[0].click();h.search('ciudad inexistente');assert.equal(h.results().length,0);assert.match(h.doc.getElementById('ciuResultados').textContent,/No hay ciudades/);assert.equal(h.doc.getElementById('ciuSelect').value,'');assert.equal(h.doc.getElementById('ghCiudadEditar'),null);assert.equal(h.calls.length,0);
});
test('limpiar búsqueda restaura selector completo y conserva la selección válida',t=>{
 const h=setup(t);h.search('Chascomus');h.results()[0].click();h.search('');assert.equal(h.doc.getElementById('ciuResultados').hidden,true);assert.equal(h.doc.getElementById('ciuSelect').hidden,false);assert.equal(h.doc.querySelectorAll('#ciuSelect option').length,4);assert.equal(h.doc.getElementById('ciuSelect').value,'CHA');assert.equal(h.calls.length,0);
});
test('consulta vacía y lista vacía no lanzan consultas ni crean registros',t=>{
 const h=setup(t,[]);h.search('Dolores');assert.match(h.doc.getElementById('ciuResultados').textContent,/No hay ciudades/);h.search('');assert.equal(h.doc.getElementById('ciuResultados').hidden,true);assert.equal(h.calls.length,0);
});
test('nombres e identificadores se presentan como texto sin inyectar botones ni imágenes',t=>{
 const h=setup(t,[{ciudad_id:'ID" onclick="alert(1)',nombre:'<img src=x onerror=alert(1)> Dolores',pais_id:'AR'}]);h.search('dolores');assert.equal(h.results().length,1);assert.equal(h.doc.querySelector('#ciuResultados img'),null);assert.equal(h.results()[0].getAttribute('onclick'),null);h.results()[0].click();assert.equal(h.doc.getElementById('ciuSelect').value,'ID" onclick="alert(1)');assert.equal(h.calls.length,0);
});
test('consultar resultado no añade permisos de eliminación a un rol secundario',t=>{
 const h=setup(t,cities,'ADMIN_LOCAL');h.search('Dolores');h.results()[0].click();assert.equal(h.doc.getElementById('ghCiudadEliminar'),null);assert.equal(h.calls.length,0);
});
test('el selector completo muestra ciudad, provincia y país antes de elegir',t=>{
 const h=setup(t);const options=[...h.doc.querySelectorAll('#ciuSelect option')];assert.equal(options[1].textContent,'Dolores · Buenos Aires · Argentina');assert.equal(options[2].textContent,'Dolores · Córdoba · Argentina');assert.equal(h.doc.getElementById('ciuSelect').value,'');assert.equal(h.calls.length,0);
});
test('buscar por país o provincia usa el mismo contexto completo y no consulta datos nuevos',t=>{
 const h=setup(t);h.search('ARGENTINA');assert.equal(h.results().length,3);h.search('cordoba');assert.equal(h.results().length,1);assert.equal(h.results()[0].textContent,'Dolores · Córdoba · Argentina');h.search('Dolores Buenos Aires');assert.equal(h.results().length,1);assert.equal(h.results()[0].dataset.ciudadId,'DOL');h.search('');assert.match(h.doc.querySelector('#ciuSelect option[value="DOL"]').textContent,/Buenos Aires.*Argentina/);assert.equal(h.calls.length,0);
});
test('contexto declarado y datos incompletos se muestran sin inventar provincia o país',t=>{
 const h=setup(t,[{ciudad_id:'SP',nombre:'San Pablo',provincia_visible:'São Paulo',pais_visible:'Brasil'},{ciudad_id:'X',nombre:'Otra ciudad'}]);assert.equal(h.doc.querySelector('#ciuSelect option[value="SP"]').textContent,'San Pablo · São Paulo · Brasil');assert.match(h.doc.querySelector('#ciuSelect option[value="X"]').textContent,/Provincia\/estado sin informar.*País sin informar/);h.search('BRASIL');assert.equal(h.results().length,1);assert.equal(h.results()[0].dataset.ciudadId,'SP');assert.equal(h.calls.length,0);
});
