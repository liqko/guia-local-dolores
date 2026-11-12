import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

// Keep the existing Hosting workflow's pre-publication check executable.
for (const file of ['plataforma/carcasa.html', 'plataforma/anunciantes.html', 'plataforma/administracion.html']) {
  const html = readFileSync(file, 'utf8');
  const ids = [...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  // Templates within scripts contain repeated dynamic IDs; inspect markup only.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const markupIds = [...markup.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(markupIds).size, markupIds.length, `${file}: duplicate control IDs`);
  for (const [, attributes, js] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/.test(attributes) && !/type\s*=\s*["'](?:application\/ld\+json|module)/.test(attributes)) {
      new Script(js, { filename: file });
    }
  }
  if(file.endsWith('/administracion.html')){
    assert.match(html,/<link\b[^>]*rel=["'](?:shortcut )?icon["']/i,'Administración: favicon ausente');
    for(const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)){
      const ref=tag[0].match(/(?:src|href)=["']([^"']+)["']/i)?.[1];if(!ref)continue;
      const url=new URL(ref,'https://fixture.local/'+file);if(url.origin!=='https://fixture.local')continue;
      assert(existsSync(decodeURIComponent(url.pathname.slice(1))),file+': referencia local inexistente '+ref);
    }
    assert.match(html,/src=["']\/plataforma\/farmacias-ciclo\.js\?v=147["']/,'Administración: conservar referencia corregida de Farmacias');
    assert.match(html,/src=["']\/plataforma\/gh-listados\.js\?v=119["']/,'Administración: conservar versión comprobada de listados');
  }
  const required = file.endsWith('/administracion.html') ? ['login','app','ghBirthdayContent','ghSesionConexionEstado'] : file.includes('carcasa')
    ? ['moduloGuia', 'modulosMenu', 'moduloCentralFrame', 'moduloEventos', 'moduloPromos', 'moduloActividades']
    : ['buscadorGlobal', 'selectClasificacion', 'accionesMulti', 'accionesResumen', 'accionesOpciones', 'contenedor', 'btnAnterior', 'btnSiguiente'];
  for (const id of required) assert(ids.includes(id), `${file}: missing ${id}`);
  console.log(`PASS ${file}: scripts and navigation controls`);
}
