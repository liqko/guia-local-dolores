// Sólo HEAD: inspecciona cabeceras públicas sin descargar el HTML.
const assert=require('node:assert/strict');
(async()=>{
 const url='https://anunciantes-guialocal.web.app/descubrir';
 const r=await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'La portada pública responde 200');
 const keep=['cache-control','etag','last-modified','age','vary','content-length','content-encoding','x-cache','server'];
 const headers=Object.fromEntries(keep.map(key=>[key,r.headers.get(key)]).filter(([,value])=>value!==null));
 console.log('HOSTING_LIVE_HEAD',JSON.stringify({url,status:r.status,headers}));
 if(!headers.etag&&!headers['last-modified'])console.log('HOSTING_NO_VALIDATOR: no es posible asumir HTTP 304 en recargas');
})().catch(e=>{console.error(e);process.exitCode=1;});
