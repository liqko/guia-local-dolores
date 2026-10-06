import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepare,pages} from '../pruebas/preparar-entorno.mjs';
import currentWorker from '../worker/app-main-v35.js';

const root=await mkdtemp(join(tmpdir(),'gld-test-package-'));
const options={workerOrigin:'https://worker-test.example.com',siteOrigin:'https://ui-test.example.com',projectId:'gld-test-isolated',out:join(root,'candidate')};
try{
  const m=await prepare(options);
  assert.equal(Object.keys(m.pages).length,9);
  for(const page of pages){
    const html=await readFile(join(options.out,'plataforma',page),'utf8');
    assert(!html.includes('login.liqkoargentina.workers.dev'),page);
    assert(!html.includes('https://guialocal.ar'),page);
    assert(html.includes(options.workerOrigin),page);
    for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new Function(script[1]);
  }
  const shell=await readFile(join(options.out,'plataforma',pages[0]),'utf8');
  assert(shell.includes(options.siteOrigin+'/suscriptores-v3.html?vista='));
  assert(shell.includes(options.siteOrigin+'/eventos-public-v1.html'));
  await assert.rejects(prepare(options),/ya existe/);
  await assert.rejects(prepare({...options,workerOrigin:'https://login.liqkoargentina.workers.dev',out:join(root,'bad')}),/separado/);
  await assert.rejects(prepare({...options,siteOrigin:'https://guialocal.ar',out:join(root,'bad')}),/separado/);
  await assert.rejects(prepare({...options,workerOrigin:'https://test.example.com/path',out:join(root,'bad')}),/separado/);
  await assert.rejects(prepare({...options,projectId:'',out:join(root,'bad')}),/ID válido/);
  await writeFile(join(options.out,'package.json'),'{"type":"module"}');
  const {default:app}=await import(pathToFileURL(join(options.out,'worker','app-controlled-test.js')));
  // Ni credenciales ni bindings se usan si el proyecto no coincide.
  const blocked={GLD_CONTROLLED_TEST:'true',FIREBASE_PROJECT_ID:'wrong-project'};
  Object.defineProperty(blocked,'GLD_CACHE_KV',{get(){throw Error('No acceder a KV');}});
  assert.equal((await app.fetch(new Request(options.workerOrigin),blocked)).status,503);
  assert.equal((await app.fetch(new Request(options.workerOrigin),{})).status,503);
  const env={GLD_CONTROLLED_TEST:'true',FIREBASE_PROJECT_ID:options.projectId,SERVER_SECRET:'test-secret',FIREBASE_CLIENT_EMAIL:'test@example.com',FIREBASE_PRIVATE_KEY:'test-only',SUSCRIPTORES_RECOVERY_URL:'https://mail-test.example.com',GLD_CACHE_KV:{get(){throw Error('No leer KV en raíz');},put(){throw Error('No escribir KV en raíz');}}};
  const result=await app.fetch(new Request(options.workerOrigin),env);
  assert.equal(result.status,200);assert.equal(result.headers.get('X-GLD-Controlled-Test'),'V38');const current=await currentWorker.fetch(new Request(options.workerOrigin),env);
  const currentVersion=(await current.json()).version;assert.match(currentVersion,/^\d+$/);
  assert.equal((await result.json()).version,currentVersion);
  console.log('OK: 9 pantallas con JS válido; destinos separados; sin sobrescritura; proyecto/configuración protegidos; Worker vigente conservado. Sin red ni despliegue.');
}finally{await rm(root,{recursive:true,force:true});}
