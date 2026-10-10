import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('./WORKER_COMPLETO_V78.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function httpError('),source.indexOf('function text(v)'));
const context=vm.createContext({Error});
vm.runInContext(helper,context);
for(const status of [400,401,403,409,503]){
 const error=vm.runInContext("httpError('Prueba',"+status+")",context);
 assert.equal(error instanceof Error,true);
 assert.equal(error.message,'Prueba');
 assert.equal(error.status,status);
 assert.equal(Object.hasOwn(error,'status'),true);
}
const calls=[...source.matchAll(/(?:return json\(await |return )resolveEventModerationV2\(\{([\s\S]*?)\}\)/g)];
assert.equal(calls.length,3);
for(const [,args] of calls)assert.match(args,/\bauth(?:\s*:\s*a)?\s*$/);
for(const name of ['assertModeratorV72','assertAdminCityV71','publicationErrorV77']){
 const begin=source.indexOf('function '+name+'(');
 const next=source.indexOf('\nfunction ',begin+1);
 assert.match(source.slice(begin,next<0?undefined:next),/throw httpError\(/);
}
assert.equal(/\b(?:e|err|error)\.status\s*=/.test(source),false);
assert.match(source,/worker_version:'78'/);
assert.match(source,/version:"78"/);
console.log('PASS: tres llamadas de moderación incluyen auth; errores HTTP tipados conservan mensaje/status; sin asignaciones status a Error; versión 78.');
