'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../plataforma/login.html'),'utf8');
const callback=/function deleteSedeCard\b[\s\S]*?reload\s*:\s*(\(\)\s*=>[^,\r\n]+)/.exec(source)?.[1];
test('la recuperación de eliminar sede usa la carga de perfil exportada',async()=>{
 assert(callback,'No se encontró la recuperación del borrado de sede');
 assert(/window\.gldLoadCommerceProfileForTags147\s*=\s*loadCommerceUI\s*;/.test(source),'Falta exportación de la función existente');
 let calls=0;const context={window:{gldLoadCommerceProfileForTags147:async()=>{calls++;return 'perfil actualizado';}}};
 assert.equal(await vm.runInNewContext('('+callback+')()',context),'perfil actualizado');assert.equal(calls,1);
});
test('el control reproduce el ReferenceError de la llamada anterior fuera de ámbito',()=>{
 const previous=callback.replace('window.gldLoadCommerceProfileForTags147','loadCommerceUI');
 assert.throws(()=>vm.runInNewContext('('+previous+')()',{window:{gldLoadCommerceProfileForTags147:()=>true}}),error=>error.name==='ReferenceError'&&/loadCommerceUI/.test(error.message));
});
