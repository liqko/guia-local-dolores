/* Unidad 4: formulario GH conectado a la ruta única de alta; el circuito servidor se prueba en tests/roles159/integration.mjs. */
const fs=require('fs'),assert=require('node:assert/strict'),test=require('node:test');
const gh=fs.readFileSync(__dirname+'/../../plataforma/administracion.html','utf8'),w=fs.readFileSync(__dirname+'/../../worker/worker206.txt','utf8');
test('GH crea con operación idempotente, titular por correo exacto y nivel 3 preseleccionado',()=>{
 for(const id of ['ghAltaNombre','ghAltaCiudad','ghAltaTitular','ghAltaNivel','ghAltaDescripcion','ghAltaCrear'])assert.ok(gh.includes('id="'+id+'"'),id);
 assert.ok(gh.includes("ghAdminRequest_('/advertisers/create',{operacion_id:GH_ALTA_OPERACION155"));
 assert.ok(gh.includes("GH_ALTA_OPERACION155||=crypto.randomUUID()"));
 assert.ok(gh.includes("String(p.mail||'').trim().toLowerCase()===mail&&p.activo!==false"));
 assert.ok(gh.includes('<summary><b>Crear anuncio</b></summary>'));assert.ok(gh.includes('await detalleAnu(saved.anunciante_id);'));
  assert.ok(gh.includes("if(v('ghAltaDireccion')&&!ciudad_id)"),'dirección sin ciudad no se envía');
 assert.match(gh,/rows="4"[^>]*id="ghAltaDescripcion"|id="ghAltaDescripcion" rows="4"/);
});
test('Worker: una sola ruta de alta, reutiliza commitOwnership155 y moderatedCreation155',()=>{
 assert.equal((w.match(/async function routeAdvertiserCreate155\(/g)||[]).length,1);
 assert.equal((w.match(/await routeAdvertiserCreate155\(ctx\)/g)||[]).length,1);
 const body=w.slice(w.indexOf('async function routeAdvertiserCreate155('),w.indexOf('async function routeAtomicAdvertiserInternal('));
 assert.ok(body.includes("if(clean(body.direccion)&&!city)")&&body.includes('const confirmed=result?.created||creation;'));
 assert.ok(body.includes('moderatedCreation155(')&&body.includes('commitOwnership155(')&&body.includes('isTopAdmin(auth)')&&body.includes('newAdvertiserLevel155('));
});
