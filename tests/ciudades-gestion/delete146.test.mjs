import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync('worker/modules/city-delete146.js','utf8');
async function run(role,linked){
 let deleted=0,puts=0,queries=0;
 const packet={version:1,paises:[{pais_id:'AR'}],provincias:[{provincia_id:'BA'}],ciudades:[{ciudad_id:'C-TEST',ciudad_visible:'Ciudad de prueba'}]};
 const context={
  authOr401:async()=>({rol:role}),
  json:(body,status=200)=>({status,...body}),
  text3:v=>String(v??'').trim(),packet:v=>v,
  ADMIN_KEY:'territorio:admin:v1',PUBLIC_KEY:'territorio:public:v1',
  GLD_ACTIONS138:{isInternal:()=>true},C:{ciudades:'ciudades'},
  remove:(rows,field,id)=>rows.filter(row=>row[field]!==id),Response:class{},
  Date,Promise
 };
 vm.createContext(context);vm.runInContext(code,context);
 const result=await context.deleteCity146({
  env:{},request:{},idFromPath:'C-TEST',
  db:{
   queryEqual:async()=>{queries++;return linked?[{id:'linked'}]:[]},
   delete:async()=>{deleted++;return true}
  },
  cache:{get:async()=>packet,put:async()=>{puts++}}
 });
 return {result,deleted,puts,queries};
}
let x=await run('SUPERADMIN_PRINCIPAL',false);
assert.equal(x.result.status,200);assert.equal(x.deleted,1);assert.equal(x.puts,10);
assert.equal(x.queries,19);
x=await run('SUPERADMIN_PRINCIPAL',true);
assert.equal(x.result.status,409);assert.equal(x.deleted,0);assert.equal(x.puts,0);
x=await run('SUPERADMIN',false);
assert.equal(x.result.status,403);assert.equal(x.deleted,0);assert.equal(x.queries,0);
console.log('PASS borrado sin vínculos; bloqueo con vínculos; permisos exclusivos; sin borrado parcial.');
