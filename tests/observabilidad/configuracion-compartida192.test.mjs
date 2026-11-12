import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../worker/worker190_roles_multiples_sobre_189.txt',import.meta.url),'utf8');
const w=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {ghFixedPacket169,gldFuncPacket166,gldLeerPrecios162,gldCoefRead173};').toString('base64'));
test('configuración, resumen y valores reutilizan los mismos paquetes; configuración comercial mantiene su propio documento',async()=>{
 const values=new Map([['admin:catalogs:v2',{}]]),reads=[];
 const cache={get:async key=>structuredClone(values.get(key)||null),put:async(key,value)=>values.set(key,structuredClone(value))};
 const db={get:async(c,id)=>{reads.push([c,id]);if(id==='FUNCIONALIDADES')return {revision:4,reglas:{PUBLICIDAD:{posiciones_max:3}}};if(id==='CATALOGO')return {revision:2,precios:{}};if(id==='COEFICIENTES_COMERCIALES')return {revision:7,levels:{}};throw Error('Lectura no esperada '+c+'/'+id);}};
 let packet=await w.ghFixedPacket169({cache,db});assert.equal(packet.reglas.reglas.PUBLICIDAD.posiciones_max,3);
 assert.deepEqual(reads,[['configuracion_plataforma','FUNCIONALIDADES'],['planes_precios','CATALOGO']]);
 // Las pestañas independientes consumen las mismas reglas y precios existentes.
 await Promise.all([w.ghFixedPacket169({cache,db}),w.gldFuncPacket166(cache,db,true),w.gldLeerPrecios162({cache,db,reconstruir:true})]);
 assert.equal(reads.length,2);
 await w.gldCoefRead173({cache,db,rebuild:true});await w.gldCoefRead173({cache,db,rebuild:true});assert.equal(reads.length,3);
 // Simula la publicación que hace el guardado: modifica la copia común e invalida el paquete derivado.
 values.set('admin:functional-settings:v1',{revision:5,reglas:{PUBLICIDAD:{posiciones_max:6}}});values.delete('admin:gh:fixed:v169');
 packet=await w.ghFixedPacket169({cache,db});assert.equal(packet.reglas.reglas.PUBLICIDAD.posiciones_max,6);assert.equal(reads.length,3);
});
