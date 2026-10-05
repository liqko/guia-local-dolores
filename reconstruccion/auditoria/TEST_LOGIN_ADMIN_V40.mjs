import assert from 'node:assert/strict';
import {superadminLoginV2} from '../worker/modules/superadmin-session-v2.js';
import {verifyAdmin} from '../worker/core/auth-admin.js';
const env={SERVER_SECRET:'test-only-admin-secret'};
const sus={id:'sus-test',suscriptor_id:'sus-test',mail:'admin@example.test',clave:'test-password',nombre:'Test',activo:true};
const permiso={id:'sus-test',suscriptor_id:'sus-test',mail:sus.mail,rol:'SUPERADMIN_PRINCIPAL',activo:true};
async function run({subscriber=sus,admin=permiso,body={mail:sus.mail,clave:sus.clave},indirect=false}={}){
  const calls=[];
  const db={
    async queryEqual(c,f,v,l){calls.push(['query',c,f,v,l]);assert.equal(l,5);if(c==='suscriptores')return subscriber&&subscriber.mail===v?[subscriber]:[];return admin&&admin.suscriptor_id===v?[admin]:[];},
    async get(c,id){calls.push(['get',c,id]);return indirect?null:admin;},
    async listCollection(){throw Error('Barrido prohibido');},
    async patch(){throw Error('Escritura prohibida');},
    async delete(){throw Error('Eliminación prohibida');}
  };
  return {out:await superadminLoginV2({env,db,body}),calls};
}
const good=await run();assert.equal(good.out.success,true);assert.equal(good.calls.length,2);
assert.equal(good.out.admin.suscriptor_id,sus.id);
assert.equal((await verifyAdmin(env,new Request('https://test.local',{headers:{Authorization:'Bearer '+good.out.token}}))).ok,true);
assert.equal((await run({body:{mail:sus.mail,clave:'wrong'}})).out.success,false);
assert.equal((await run({subscriber:null})).out.success,false);
assert.equal((await run({subscriber:{...sus,activo:false}})).out.success,false);
assert.equal((await run({admin:null})).out.success,false);
assert.equal((await run({admin:{...permiso,activo:false}})).out.success,false);
assert.equal((await run({admin:{...permiso,rol:'VENDEDOR'}})).out.success,false);
assert.equal((await run({indirect:true})).out.success,true);
assert.equal((await run({subscriber:{...sus,mail:'Admin@Example.Test'},body:{mail:'Admin@Example.Test',clave:sus.clave}})).out.success,true);
console.log('Login admin V40: credenciales de suscriptor, permisos por ID, rechazos y sesión HMAC aprobados; sin barridos ni mutaciones.');
