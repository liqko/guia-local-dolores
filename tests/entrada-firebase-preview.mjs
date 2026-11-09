import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const entry=read('plataforma/entrada-recordada.js'),inicio=read('plataforma/inicio.html'),carcasa=read('plataforma/carcasa.html'),users=read('plataforma/suscriptores.html');
const brand=read('plataforma/marca-global.js'),visor=read('plataforma/visor-web-global.js'),guide=read('plataforma/anunciantes.html');
const hosting=JSON.parse(read('firebase.json')).hosting;
for(const [file,source] of [['marca-global.js',brand],['visor-web-global.js',visor],['entrada-recordada.js',entry]]){
  new Script(source,{filename:file});
  console.log('PASS sintaxis '+file);
}
assert.ok(hosting.rewrites.some(r=>r.source==='/'&&r.destination==='/plataforma/inicio.html'));
assert.match(entry,/if\(!sid\)\{[\s\S]*?recordada:false/);
assert.match(inicio,/new URL\('\/descubrir',window\.location\.origin\)/);
assert.match(users,/window\.location\.replace\('\/elegi-tu-ciudad\?cambiar_ciudad=1'\)/);
assert.match(carcasa,/window\.location\.assign\('\/elegi-tu-ciudad\?cambiar_ciudad=1'\)/);
assert.match(carcasa,/plataforma\/visor-web-global\.js/);
assert.match(guide,/puenteWebDisponible/);
assert.match(guide,/tipo:'gld:visor-web:abrir'/);
assert.match(visor,/document\.documentElement\.style\.overflow='hidden'/);
assert.match(visor,/gld:visor-web:cerrado/);
for(const path of ['plataforma/inicio.html','plataforma/carcasa.html','plataforma/suscriptores.html','plataforma/login.html','plataforma/granhermano.html','plataforma/nosotros.html','plataforma/privacidad.html','plataforma/app-prueba.html']){
  assert.match(read(path),/marca-global\.js/,path+' branding');
}
assert.match(brand,/Panel administrador/);
assert.match(brand,/\/administracion/);
assert.match(brand,/\/anunciantes/);
assert.match(brand,/\/mi-guia/);
assert.match(brand,/\/plataforma\/pie\.html/);
assert.match(inicio,/gld-city-pin/);
assert.match(carcasa,/gld-city-pin/);
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'/elegi-tu-ciudad?app_prueba=1');
assert.ok(users.includes('<h3>Ciudad predeterminada</h3>'));
assert.ok(!carcasa.includes('id="banner-inicio"'));
assert.ok(carcasa.includes('id="topBtn"'));
assert.ok(carcasa.includes("window.addEventListener('scroll',actualizar"));
const app=read('plataforma/app-prueba.html');
assert.ok(app.includes('pwa-web.js'));
assert.ok(app.includes('Comprobar instalación'));
assert.ok(app.includes('if(!pendiente)'));
assert.ok(app.includes('[hidden]{display:none!important}'));
console.log('PASS ciudad predeterminada, sin casita, botón subir, instalación con respuesta');
assert.ok(brand.includes('position:sticky;top:0'),'navegación visible al desplazarse');
assert.ok(brand.includes("drawer.open=true"),'enlaces visibles en escritorio');
assert.ok(brand.includes('gld-volver-guia'),'regreso disponible desde paneles');
assert.ok(app.includes("window.location.replace('/elegi-tu-ciudad')"),'la app instalada no debe mostrar pantalla intermedia');
console.log('PASS menú navegable, regreso a Guía y entrada directa app');
assert.ok(brand.includes('function urlGuiaActual()'),'la navegación debe conservar ciudad elegida');
assert.ok(brand.includes("a.href=href==='/'?urlGuiaActual():href"),'Inicio no debe volver a predeterminada');
assert.ok(brand.includes('regreso.href=urlGuiaActual()'),'Volver no debe volver a predeterminada');
assert.ok(carcasa.includes("if(ciudadUrl && String(ctx.ciudad_id||'').trim()!==ciudadUrl)ctx={}"),'módulos deben aislar ciudades');
assert.ok(carcasa.includes("if(explicitCity && String(ctx?.ciudad_id||'').trim()!==explicitCity)ctx=null"),'carcasa debe aislar ciudades');
assert.ok(guide.includes("if(ciudadUrl&&String(ctx?.ciudad_id||'').trim()!==ciudadUrl)ctx=null"),'anuncios deben aislar ciudades');
console.log('PASS ciudad explícita aislada de contexto anterior y retorno a ciudad elegida');
console.log('PASS integración de raíz, ciudades, menú, visor, 3 interfaces, pie y app de prueba');

// Las rutas públicas son independientes de la estructura de archivos.
for(const [source,destination] of [['/elegi-tu-ciudad','/plataforma/inicio.html'],['/descubrir','/plataforma/carcasa.html']]){
  assert.ok(hosting.rewrites.some(r=>r.source===source&&r.destination===destination),`Falta rewrite ${source}`);
}
assert.ok(!hosting.redirects.some(r=>r.source==='/'));
assert.ok(!existsSync('index.html'), 'index.html no debe interceptar la ruta raíz');
console.log('PASS rutas públicas amigables y acceso directo por Firebase Hosting');

for(const [source,destination,label] of [
 ['/ecosistema','/plataforma/nosotros.html','Nuestro ecosistema'],
 ['/app','/plataforma/app-prueba.html','App'],
 ['/politicas-y-privacidad','/plataforma/privacidad.html','Políticas, fuentes y privacidad'],
 ['/mi-guia','/plataforma/suscriptores.html','Suscriptores'],
 ['/anunciantes','/plataforma/login.html','Anunciantes'],
 ['/administracion','/plataforma/administracion.html','Panel administrador']
]){
 assert.ok(hosting.rewrites.some(r=>r.source===source&&r.destination===destination),`Falta rewrite ${source}`);
 assert.ok(brand.includes(`['${label}','${source}']`),`Falta menú ${label}`);
 assert.ok(!hosting.redirects.some(r=>r.source===source),`Redirect inesperado ${source}`);
}
console.log('PASS navegación pública del menú completo');
