// Paso 4: contrapruebas aisladas sin Cloudflare, Firebase ni escritura real.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const login=fs.readFileSync(path.join(__dirname,'../plataforma/login.html'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../worker/worker206.txt'),'utf8');

test('P4-0002: respuesta incierta de baja de sede recarga por puente del mismo ámbito',async()=>{
  assert.match(login,/window\.gldReloadCommerceUIForVerification_\s*=\s*loadCommerceUI/);
  assert.match(login,/reload:\(\)=>window\.gldReloadCommerceUIForVerification_\(\)/);
  const sedeDelete=login.slice(login.indexOf('async function deleteSedeCard('),login.indexOf("document.addEventListener('click', function(e)",login.indexOf('async function deleteSedeCard(')));
  assert.doesNotMatch(sedeDelete,/reload:\(\)=>loadCommerceUI\(\)/);
  const expression=login.match(/reload:(\(\)=>window\.gldReloadCommerceUIForVerification_\(\))/)?.[1];
  assert(expression,'Falta callback verificable');
  let calls=0;
  const cb=Function('window','return '+expression)({gldReloadCommerceUIForVerification_:async()=>{calls++;return true;}});
  assert.equal(await cb(),true);
  assert.equal(calls,1);
});

test('P4-0009: no se reescribe KV público si Promociones no cambia; sí ante cambios',async()=>{
  const start=worker.indexOf('async function syncPromo(');
  const end=worker.indexOf('async function getPromosCity(',start);
  assert(start>=0&&end>start);
  const src=worker.slice(start,end);
  assert.match(src,/GLD_BUSINESS143\.equal\(packet2\.promos\|\|\[\],sorted\)/);
  let writes=0,adminUpdates=0,reads=0;
  const packet={version:1,ciudad_id:'DOLORES',promos:[{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'}]};
  const cache={get:async()=>{reads++;return packet;},put:async()=>{writes++;}};
  const injected=`
    const text5=v=>String(v??'').trim();
    const promoCityKey=id=>'promos:city:v1:'+id;
    const visible=p=>p.estado!=='PAUSADA';
    const publicPromo=p=>({promo_id:p.promo_id,ciudad_id:p.ciudad_id,promo:p.promo});
    const sort=rows=>[...rows].sort((a,b)=>a.promo.localeCompare(b.promo));
    const GLD_BUSINESS143={equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)};
    const syncAdminPromoV91=async()=>{adminUpdates();};
  `;
  const sync=Function('adminUpdates',injected+src+';return syncPromo')(()=>{adminUpdates++;});
  // Función auxiliar inyectada: en este ensayo no afecta el contador de escrituras públicas.
  await sync({cache,current:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'},next:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'}});
  assert.equal(writes,0,'El paquete idéntico no debe escribirse');
  await sync({cache,current:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Oferta'},next:{promo_id:'P-1',ciudad_id:'DOLORES',promo:'Otra oferta'}});
  assert.equal(writes,1,'Una modificación visible debe escribir el paquete');
  assert.equal(reads,2,'Se mantiene una lectura por sincronización');
});
