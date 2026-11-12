import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
test('existe una única entrega Worker y las pruebas activas apuntan a esa ruta',async()=>{
 const name='worker191_consolidado_sobre_190_d8446f0.txt';
 const files=await readdir(new URL('../worker/',import.meta.url));assert.deepEqual(files,[name]);
 for(const path of ['worker-editor191.cjs','publicacion-generica.test.mjs','observabilidad/roles-cache192.test.mjs','observabilidad/configuracion-compartida192.test.mjs','observabilidad/corte-ciudad.test.mjs']){
  const source=await readFile(new URL(path,import.meta.url),'utf8');assert(source.includes(name),path+' usa una entrega diferente');
 }
});
