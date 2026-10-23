import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

// Keep the existing Hosting workflow's pre-publication check executable.
for (const file of ['plataforma/carcasa.html', 'plataforma/anunciantes.html']) {
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
  const required = file.includes('carcasa')
    ? ['moduloGuia', 'modulosMenu', 'moduloCentralFrame', 'moduloEventos', 'moduloPromos', 'moduloActividades']
    : ['buscadorGlobal', 'selectClasificacion', 'accionesMulti', 'accionesResumen', 'accionesOpciones', 'contenedor', 'btnAnterior', 'btnSiguiente'];
  for (const id of required) assert(ids.includes(id), `${file}: missing ${id}`);
  console.log(`PASS ${file}: scripts and navigation controls`);
}
