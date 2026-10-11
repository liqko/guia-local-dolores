import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../plataforma/anunciantes-utilidades.js',import.meta.url),'utf8');
const c=vm.createContext({URL,URLSearchParams,Date,console});vm.runInContext(source,c);const ui=c.GLD_ANUNCIANTES_UI;
const p=ui.parametros('https://test.invalid/plataforma/carcasa.html?token=PRIVADO','https://guialocal.ar/guia/?ciudad_id=D&anunciante_id=A&sede_id=S',true);
assert.equal(p.get('ciudad_id'),'D');assert.equal(p.get('anunciante_id'),'A');
assert.equal(ui.parametros('https://test.invalid/?ciudad_id=X','https://guialocal.ar/?ciudad_id=D&anunciante_id=A',true).get('anunciante_id'),null);
assert.equal(ui.parametros('https://test.invalid/','https://guialocal.ar/?anunciante_id=A',false).get('anunciante_id'),null);
const url=new URL(ui.urlFicha('A/&?',{ciudad_id:'D',token:'PRIVADO'},'S&1'));
assert.equal(url.origin,'https://guialocal.ar');assert.equal(url.searchParams.get('anunciante_id'),'A/&?');assert.equal(url.searchParams.get('sede_id'),'S&1');assert.equal(url.searchParams.has('token'),false);
const rows=[{id:'A',sedes:[{sede_id:'S1'},{sede_id:'S2'}]},{id:'B',sedes:[{sede_id:'S2'}]}];
const target=ui.filtroFicha(rows,new URLSearchParams('anunciante_id=A&sede_id=S2'));
assert.equal(target.length,1);assert.equal(target[0].sedes.length,1);assert.equal(rows[0].sedes.length,2);
assert.equal(ui.filtroFicha(rows,new URLSearchParams('anunciante_id=A&sede_id=NO')).length,0);
const auth=[{anunciante_id:'Z',anunciante_nombre:'Zeta',rol:'PROPIETARIO',permisos:['EVENTOS']},{anunciante_id:'A',anunciante_nombre:'Álamo',rol:'MANAGER'},{anunciante_id:'B',anunciante_nombre:'Bravo'}];
assert.deepEqual(Array.from(ui.ordenarAutorizados(auth),x=>x.anunciante_id),['A','B','Z']);assert.equal(auth[0].anunciante_id,'Z');assert.equal(ui.ordenarAutorizados(auth)[2],auth[0]);
let called=0,opened=0,copied='';
assert.equal(await ui.compartir({id:'A',contexto:{ciudad_id:'D'}},{share:async d=>{called++;assert.match(d.url,/anunciante_id=A/);}},()=>opened++),'compartido');assert.equal(called,1);assert.equal(opened,0);
assert.equal(await ui.compartir({id:'A'},{share:async()=>{throw Object.assign(new Error(),{name:'AbortError'});},clipboard:{writeText:async()=>called++}},()=>opened++),'cancelado');assert.equal(called,1);assert.equal(opened,0);
assert.equal(await ui.compartir({id:'A'},{clipboard:{writeText:async v=>copied=v}},()=>opened++),'copiado');assert.match(copied,/anunciante_id=A/);
assert.equal(await ui.compartir({id:'A'},{clipboard:{writeText:async()=>{throw new Error('Sin permiso');}}},url=>{opened++;assert.match(url,/^https:\/\/wa.me\/\?text=/);}), 'whatsapp');
const almacen={getItem:()=>JSON.stringify({anunciante_id:'A',ciudad_id:'D',actividad_ids:['T1'],ts:1000})};
const f=ui.filtroActividades(new URLSearchParams('ciudad_id=D'),almacen,2000);
assert.equal(ui.actividadCoincide({anunciante_id:'A',actividad_id:'T1'},f),true);
assert.equal(ui.actividadCoincide({anunciante_id:'B',actividad_id:'T1'},f),false);
assert.equal(ui.actividadCoincide({anunciante_id:'A',actividad_id:'T2'},f),false);
assert.equal(ui.filtroActividades(new URLSearchParams('ciudad_id=X'),almacen,2000),null);
assert.equal(ui.filtroActividades(new URLSearchParams('ciudad_id=D'),almacen,700000),null);
assert.equal(ui.filtroActividades(new URLSearchParams('anunciante_id=B'),almacen,2000).anunciante_id,'B');
for(const name of ['anunciantes','actividades','login','suscriptores','carcasa']){
 const html=fs.readFileSync(new URL('../plataforma/'+name+'.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1]);
 assert.match(html,/anunciantes-utilidades.js/);
}
const guide=fs.readFileSync(new URL('../plataforma/anunciantes.html',import.meta.url),'utf8');
assert.match(guide,/if\(item.bloqueado18\) return window.GLD_ADULT.card\(\);/);
assert.equal(/actividades-activas-btn" href="#"/.test(guide),false);
assert.match(guide,/getDestacadas\(filtrados\)/);
console.log('PASS: compartir nativo/copia/WhatsApp, cancelación, URL sin secretos, ficha y sede por ID, filtros de actividades, ciudades distintas, autorizaciones sin mutación y sintaxis de cinco páginas.');
function extract(html,name,next){
 const start=html.indexOf('function '+name+'(');
 const end=html.indexOf('function '+next+'(',start+1);
 assert.ok(start>=0&&end>start,name);
 return html.slice(start,end);
}
const shell=fs.readFileSync(new URL('../plataforma/carcasa.html',import.meta.url),'utf8');
const shellContext=vm.createContext({URL,GLD_ANUNCIANTES_UI:ui,window:{location:{href:'https://test.invalid/plataforma/carcasa.html'},parent:{}},document:{referrer:'https://guialocal.ar/guia/?ciudad_id=D&anunciante_id=A&sede_id=S'},localStorage:{getItem:()=>JSON.stringify({ciudad_id:'OTRA'})}});
vm.runInContext(extract(shell,'contextoUrl','guardarFiltroTarjeta_'),shellContext);
const embedded=new URL(vm.runInContext("contextoUrl('./anunciantes.html')",shellContext));
assert.equal(embedded.searchParams.get('ciudad_id'),'D');assert.equal(embedded.searchParams.get('anunciante_id'),'A');assert.equal(embedded.searchParams.get('sede_id'),'S');
assert.equal(new URL(vm.runInContext("contextoUrl('./actividades.html')",shellContext)).searchParams.has('sede_id'),false);
const linksContext=vm.createContext({
 URL,URLSearchParams,ciudadSeleccionada:'D',ACTIVIDADES_PAGE_URL:'https://guialocal.ar/actividades/',
 activeActivitiesForAdvertiser:()=>[{actividad_id:'T1'}],advertiserIds:()=>['A']
});
vm.runInContext(extract(guide,'renderActividadesActivasButton','capitalizarFrase'),linksContext);
assert.match(vm.runInContext("renderActividadesActivasButton({nombre:'Álamo'})",linksContext),/href="https:\/\/guialocal.ar\/actividades\/\?anunciante_id=A&amp;ciudad_id=D"|href="https:\/\/guialocal.ar\/actividades\/\?anunciante_id=A&ciudad_id=D"/);
const cardsContext=vm.createContext({
 window:{GLD_ADULT:{card:()=>'<article class="adult-locked">+18</article>'}},gldFavoritosAnunciantes:new Set(),
 gldInsigniaActiva:()=>false,renderInsignias:()=>'',renderContactoNuevo:()=>'',renderRedesNivel3:()=>'',renderRedesNivel4:()=>'',descripcionNivel_:()=>'',renderRedesBloque:()=>'',renderGaleria:()=>'',renderEventosActivosButton:()=>'',renderPromosActivasButton:()=>'',renderActividadesActivasButton:()=>''
});
vm.runInContext(extract(guide,'renderCard','renderBanner'),cardsContext);
assert.match(vm.runInContext("renderCard({id:'A',nombre:'Normal',nivel:3},'G')",cardsContext),/gld-share-anunciante-btn/);
const locked=vm.runInContext("renderCard({id:'ADULT',nivel:6,bloqueado18:true},'G')",cardsContext);
assert.match(locked,/adult-locked/);assert.doesNotMatch(locked,/gld-share/);
assert.match(vm.runInContext("renderCard({id:'A',nombre:'Normal',nivel:5,__sede_individual:true,sedes:[{sede_id:'S'}]},'G')",cardsContext),/data-sede-id="S"/);
console.log('PASS integración: carcasa transmite ficha/sede y prioriza ciudad explícita; enlaces a Actividades reales; Compartir se muestra en gratis y no en contenido +18 bloqueado.');
