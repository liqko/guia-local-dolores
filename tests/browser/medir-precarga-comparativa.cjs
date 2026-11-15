// Comparación controlada: misma instalación y mismos archivos; solo varía el Service Worker.
// No consulta Firebase ni Cloudflare: mide bytes HTTP efectivamente enviados por el servidor local.
const {execFileSync}=require('node:child_process');
const {createServer}=require('node:http');
const {readFileSync,existsSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const OLD=execFileSync('git',['show','origin/main:plataforma/sw.js'],{encoding:'utf8'});
const NEW=readFileSync('plataforma/sw.js','utf8');
async function measure(label,source){
  const requested=[],root=resolve('plataforma');
  const server=createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/plataforma/sw.js'){
      res.setHeader('Content-Type','text/javascript');
      res.setHeader('Cache-Control','no-store');
      res.end(source);requested.push({path:pathname,bytes:Buffer.byteLength(source),status:200});return;
    }
    if(pathname==='/plataforma/audit.html'){
      const body='<!doctype html><html><body>Prueba de instalación sin carga extra</body></html>';
      res.setHeader('Content-Type','text/html');res.end(body);requested.push({path:pathname,bytes:Buffer.byteLength(body),status:200});return;
    }
    if(!pathname.startsWith('/plataforma/')){res.writeHead(404).end();return;}
    const file=resolve('.'+pathname);
    if(!file.startsWith(root+'/')||!existsSync(file)){
      res.writeHead(404).end();requested.push({path:pathname,bytes:0,status:404});return;
    }
    const body=readFileSync(file);
    res.setHeader('Content-Type',pathname.endsWith('.html')?'text/html':'text/javascript');
    res.end(body);requested.push({path:pathname,bytes:body.byteLength,status:200});
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.GLD_CHROME||undefined,headless:true,args:['--no-sandbox']});
    const ctx=await browser.newContext({serviceWorkers:'allow'});
    const page=await ctx.newPage();
    const origin='http://127.0.0.1:'+server.address().port;
    await page.goto(origin+'/plataforma/audit.html');
    await page.evaluate(async()=>{
      const reg=await navigator.serviceWorker.register('/plataforma/sw.js',{scope:'/plataforma/'});
      await navigator.serviceWorker.ready;
      if(reg.installing)await new Promise((ok,fail)=>{
        reg.installing.addEventListener('statechange',function(){if(this.state==='activated')ok();if(this.state==='redundant')fail(Error('SW redundant'));});
      });
    });
    await page.waitForTimeout(350);
    await ctx.close();
    const extras=requested.filter(x=>x.path!=='/plataforma/sw.js'&&x.path!=='/plataforma/audit.html');
    return {label,additionalRequests:extras.length,additionalBytes:extras.reduce((a,x)=>a+x.bytes,0),extras};
  }finally{
    if(browser)await browser.close();
    await new Promise(ok=>server.close(ok));
  }
}
(async()=>{
  const actual=await measure('actual',OLD);
  const corregida=await measure('corregida',NEW);
  assert(actual.additionalRequests>corregida.additionalRequests,'La corrección debe reducir solicitudes de instalación');
  assert(actual.additionalBytes>corregida.additionalBytes,'La corrección debe reducir datos enviados');
  assert.equal(corregida.additionalRequests,1,'Sólo debe descargar offline.html');
  console.log('COMPARACION_REAL_BYTES',JSON.stringify({actual,corregida,solicitudesEvitadas:actual.additionalRequests-corregida.additionalRequests,bytesEvitados:actual.additionalBytes-corregida.additionalBytes}));
})().catch(e=>{console.error(e);process.exitCode=1});
