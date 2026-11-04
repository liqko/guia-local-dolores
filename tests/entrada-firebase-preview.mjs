import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const entry=read('plataforma/entrada-recordada.js'),inicio=read('plataforma/inicio.html'),carcasa=read('plataforma/carcasa.html'),users=read('plataforma/suscriptores.html');
const brand=read('plataforma/marca-global.js'),visor=read('plataforma/visor-web-global.js'),guide=read('plataforma/anunciantes.html');
const root=read('index.html');
for(const [file,source] of [['marca-global.js',brand],['visor-web-global.js',visor],['entrada-recordada.js',entry]]){
  new Script(source,{filename:file});
  console.log('PASS sintaxis '+file);
}
assert.match(root,/location\.replace\('\/plataforma\/inicio\.html'/);
assert.match(entry,/if\(!sid\)\{[\s\S]*?recordada:false/);
assert.match(inicio,/new URL\('\/plataforma\/carcasa\.html',window\.location\.origin\)/);
assert.match(users,/window\.location\.replace\('\/plataforma\/inicio\.html\?cambiar_ciudad=1'\)/);
assert.match(carcasa,/window\.location\.assign\('\/plataforma\/inicio\.html\?cambiar_ciudad=1'\)/);
assert.match(carcasa,/plataforma\/visor-web-global\.js/);
assert.match(guide,/puenteWebDisponible/);
assert.match(guide,/tipo:'gld:visor-web:abrir'/);
assert.match(visor,/document\.documentElement\.style\.overflow='hidden'/);
assert.match(visor,/gld:visor-web:cerrado/);
for(const path of ['plataforma/inicio.html','plataforma/carcasa.html','plataforma/suscriptores.html','plataforma/login.html','plataforma/granhermano.html','plataforma/nosotros.html','plataforma/privacidad.html','plataforma/app-prueba.html']){
  assert.match(read(path),/marca-global\.js/,path+' branding');
}
assert.match(brand,/Panel administrador/);
assert.match(brand,/\/plataforma\/granhermano\.html/);
assert.match(brand,/\/plataforma\/login\.html/);
assert.match(brand,/\/plataforma\/suscriptores\.html/);
assert.match(brand,/\/plataforma\/pie\.html/);
assert.match(inicio,/gld-city-pin/);
assert.match(carcasa,/gld-city-pin/);
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'/plataforma/inicio.html?app_prueba=1');
console.log('PASS integración de raíz, ciudades, menú, visor, 3 interfaces, pie y app de prueba');
