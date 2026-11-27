import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {versionarRecursos} from '../scripts/versionar-recursos-publicos.mjs';
test('Recursos publicados: revisión por contenido, imágenes intactas y actualización automática',async()=>{
 const stage=await mkdtemp(join(tmpdir(),'gld-build-'));
 try{
  await cp('plataforma',join(stage,'plataforma'),{recursive:true});
  const originals=Object.fromEntries(await Promise.all((await readdir(join(stage,'plataforma'))).filter(p=>p.endsWith('.html')).map(async p=>[p,await readFile(join(stage,'plataforma',p),'utf8')])));
  const reset=async()=>{for(const [p,s] of Object.entries(originals))await writeFile(join(stage,'plataforma',p),s);};
  const first=await versionarRecursos(stage);
  assert(first.resources>10);
  const html=await readFile(join(stage,'plataforma/carcasa.html'),'utf8');
  assert(!/<script\b[^>]*src=["']\/plataforma\/(?!assets\/app\/)/.test(html));
  const footer=await readFile(join(stage,'plataforma/pie.html'),'utf8');
  const telemetry=first.files['/plataforma/telemetria.js'];
  assert(html.includes('src="'+telemetry+'"'));
  assert(footer.includes('src="'+telemetry+'"'));
  for(const image of ['logo-guia-local.png','fondo-ciudad.jpg']){
   const original='/plataforma/assets/marca/'+image;
   assert.deepEqual(await readFile(join(stage,first.files[original])),await readFile(join(stage,original)));
  }
  const brand=await readFile(join(stage,first.files['/plataforma/marca-global.js']),'utf8');
  assert(!brand.includes('/plataforma/assets/marca/'));
  assert(brand.includes("footer.src='/plataforma/pie'"));
  assert(html.includes("url:'./empleo'"));
  assert(html.includes("url:'./anunciantes'"));
  assert(!html.includes("url:'./anunciantes.html'"));
  const from=html.indexOf('  function contextoUrl('),to=html.indexOf('  function guardarFiltroTarjeta_(',from);
  const context=Function('window','localStorage',html.slice(from,to)+';return contextoUrl')(
   {location:{origin:'https://fixture.invalid',search:'?ciudad_id=DOL&anunciante_id=A1&sede_id=S1'}},{getItem:()=>null});
  assert.deepEqual(Object.fromEntries(new URL(context('./anunciantes')).searchParams),{ciudad_id:'DOL',anunciante_id:'A1',sede_id:'S1'});
  assert.deepEqual(Object.fromEntries(new URL(context('./anunciantes.html')).searchParams),{ciudad_id:'DOL',anunciante_id:'A1',sede_id:'S1'});
  assert.deepEqual(Object.fromEntries(new URL(context('./empleo')).searchParams),{ciudad_id:'DOL'});
  assert(JSON.parse(await readFile('firebase.json','utf8')).hosting.cleanUrls);
  await reset();
  const again=await versionarRecursos(stage);
  assert.deepEqual(again.files,first.files);
  await reset();
  await writeFile(join(stage,'plataforma/territorio-cache.js'),'window.GLD_CATALOGO_TERRITORIAL={revision:2};');
  const changed=await versionarRecursos(stage);
  assert.notEqual(changed.files['/plataforma/territorio-cache.js'],first.files['/plataforma/territorio-cache.js']);
  assert.equal(changed.files['/plataforma/paquete-ciudad.js'],first.files['/plataforma/paquete-ciudad.js']);
  const built=await readFile(join(stage,'plataforma/carcasa.html'),'utf8');
  await versionarRecursos(stage);
  assert.equal(await readFile(join(stage,'plataforma/carcasa.html'),'utf8'),built);
 }finally{await rm(stage,{recursive:true,force:true});}
});
