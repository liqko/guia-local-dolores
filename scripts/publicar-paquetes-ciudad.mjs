import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { aplicarCorte, ultimoCorte } from './aplicar-corte-paquetes-ciudad.mjs';

const worker = 'https://login.liqkoargentina.workers.dev/internal/city-books';
const hosting = 'https://anunciantes-guialocal.web.app/';
const audience = 'guialocal:publicacion-ciudades';

async function readJson(read, url, {allowMissing, observe=()=>{}, capture=()=>{}, ...options} = {}) {
  const response = await read(url, {...options,redirect:'error',signal:AbortSignal.timeout(90000)});
  const raw=await response.text(),target=new URL(url);
  observe({service:target.origin===new URL(hosting).origin?'hosting':target.href===worker?'worker':'identidad',
    method:options.method??'GET',status:response.status,requestBodyBytes:Buffer.byteLength(options.body??''),
    responseBodyBytes:Buffer.byteLength(raw)});
  capture(response);
  if (response.status === 404 && allowMissing) return null;
  if (!response.ok) {
    let detail='';
    try { const parsed=JSON.parse(raw); if(typeof parsed?.message==='string') detail=parsed.message.replace(/[\r\n]/g,' ').slice(0,300); } catch {}
    throw Error('No se pudo completar la publicación ('+response.status+') en '+target.pathname+(detail?': '+detail:''));
  }
  return JSON.parse(raw);
}

async function githubIdentity(read,observe) {
  const {ACTIONS_ID_TOKEN_REQUEST_URL:url,ACTIONS_ID_TOKEN_REQUEST_TOKEN:token} = process.env;
  if (!url || !token) throw Error('Falta identidad del trabajo de publicación');
  const target = new URL(url);
  if (target.protocol !== 'https:') throw Error('URL de identidad inválida');
  target.searchParams.set('audience',audience);
  const data = await readJson(read,target,{headers:{Authorization:'Bearer '+token},observe});
  if (typeof data?.value !== 'string') throw Error('Identidad de publicación inválida');
  return data.value;
}

export async function publicarPaquetes({mode,stage,forceStage=false,cutoff=ultimoCorte(),read=fetch,urgentScope,reusePublished=false,privateSeparate=false,verifyPublished=false,
  identity=githubIdentity,observe,planPath,recoverCurrent=false,ghSummaryPath}) {
  const call = async (body,allowMissing=false) => readJson(read,worker,{
    method:'POST',allowMissing,observe,
    headers:{Authorization:'Bearer '+await identity(read,observe),'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if(mode==='private'){
    const result=await call({op:recoverCurrent?'private-recovery':'private',cutoff});
    if(result?.success!==true||result.cutoff!==cutoff)throw Error('El corte privado no quedó confirmado');
    return {cutoff};
  }
  const indexPath='plataforma/paquetes-ciudad/publicacion.json';
  if (mode === 'commit') {
    let installed;
    if(verifyPublished||ghSummaryPath){
      installed=await readJson(read,new URL(indexPath,hosting),{cache:'no-store',observe});
      if(installed.cutoff!==cutoff)throw Error('Hosting todavía no confirma el índice del corte');
      if(verifyPublished){const expected=JSON.parse(await readFile(join(stage,indexPath),'utf8'));if(!isDeepStrictEqual(expected,installed))throw Error('Hosting todavía no confirma el índice del corte');}
    }
    let gh_summary;
    if(ghSummaryPath){
      gh_summary=JSON.parse(await readFile(ghSummaryPath,'utf8'));
      if(gh_summary.cutoff!==cutoff||!isDeepStrictEqual(Object.keys(gh_summary.cities).sort(),Object.keys(installed.manifest).sort())||Object.entries(installed.manifest).some(([city,entry])=>entry.revision!==gh_summary.cities[city]?.revision))throw Error('Resumen no corresponde a la edición instalada');
    }
    const result = await call({op:privateSeparate?'commit-public':'commit',cutoff,...(gh_summary?{gh_summary}:{})});
    if (result?.success !== true) throw Error('El último corte no quedó confirmado');
    if(privateSeparate&&result.cutoff!==cutoff)throw Error('El Worker no confirmó el corte público esperado');
    if (result.private_daily?.status === 'pending') throw Error('El corte público quedó confirmado, pero falta preparar Gran Hermano. Reintentá el mismo publicador; no hace falta volver a publicar desde el panel.');
    return {cutoff};
  }
  if (!['cut','preserve','urgent'].includes(mode) || !stage) throw Error('Modo de publicación inválido');
  let base;
  const previous = await readJson(read,new URL(indexPath,hosting),{
    allowMissing:true,observe,headers:{'Accept-Encoding':'identity'},
    capture:response=>{base={status:response.status,etag:response.headers.get('etag')};},
  });
  if(planPath){
    if(base.status!==404&&(!base.etag||!/^"[^"\r\n]+"$/.test(base.etag)))throw Error('Falta huella verificable del índice instalado.');
    const contentHash=previous&&createHash('sha256').update(JSON.stringify({manifest:previous.manifest,schema:previous.schema})).digest('hex');
    await writeFile(planPath,JSON.stringify({...base,cutoff:previous?.cutoff,contentHash}),{mode:0o600});
  }
  if (mode === 'preserve' && !previous) return {changed:false};
  const manifest = previous?.manifest ?? {};
  const readPublished = path => readJson(read,new URL(path,hosting),{observe});
  if (mode === 'preserve') {
    return aplicarCorte({previous,
      source:{after:previous.cutoff,cutoff:previous.cutoff,complete:true,cities:[]},
      readPublished,stage,forceStage:true,reusePublished});
  }
  if (mode === 'urgent') {
    if (!previous || !Array.isArray(urgentScope) || !urgentScope.length) throw Error('Falta la edición o el alcance urgente');
    const scope = urgentScope.map(entry=>{
      const city = entry?.city;
      if (!Object.hasOwn(manifest,city)) throw Error('La ciudad urgente no tiene una edición publicada');
      return {city,module:entry.module,ids:entry.ids,from:manifest[city].revision};
    });
    const source = await call({op:'urgent',cutoff,scope});
    if (source.urgent !== true || source.cutoff !== cutoff || source.after !== cutoff) throw Error('Respuesta urgente inválida');
    return aplicarCorte({previous:{...previous,cutoff},source,readPublished,stage,reusePublished});
  }

  if(recoverCurrent&&(!privateSeparate||mode!=='cut'))throw Error('Recuperación excepcional fuera de alcance');
  const source = await call({op:recoverCurrent?'read-public-recovery':privateSeparate?'read-public':'read',cutoff,publishedCutoff:previous?.cutoff??null,known:Object.keys(manifest),...(previous?.schema?{schema:previous.schema}:{})},!previous);
  if (!source) return {changed:false};
  if (source.cutoff !== cutoff || !Number.isSafeInteger(source.after) ||
      (previous && source.after < previous.cutoff)) throw Error('El Worker devolvió otro corte');
  if(source.recoveredAt!==undefined&&!recoverCurrent)throw Error('Recuperación no autorizada');
  const result=await aplicarCorte({previous:{cutoff:source.after,manifest,schema:previous?.schema,recoveredAt:previous?.recoveredAt},source,readPublished,stage,forceStage,reusePublished,ghSummaryPath});
  if(privateSeparate&&previous&&previous.cutoff<cutoff&&!result.changed&&!forceStage){
    await mkdir(join(stage,'plataforma/paquetes-ciudad'),{recursive:true});
    const {recoveredAt:oldRecovery,...prior}=previous;
    await writeFile(join(stage,indexPath),JSON.stringify({...prior,cutoff,...(source.recoveredAt===undefined?{}:{recoveredAt:source.recoveredAt})}));
    return {...result,watermark:true};
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode,stage,cutoff] = process.argv.slice(2);
  const operations=[];
  const result = await publicarPaquetes({mode,stage,
    observe:operation=>operations.push(operation),
    planPath:process.env.GLD_HOSTING_PLAN,ghSummaryPath:process.env.GLD_GH_PUBLIC_SUMMARY,
    ...(cutoff?{cutoff:Number(cutoff)}:{}),forceStage:process.env.GLD_STAGE_UNCHANGED==='1',reusePublished:process.env.GLD_REUSE_PUBLISHED==='1',
    privateSeparate:process.env.GLD_PRIVATE_DAILY_SEPARATE==='1',verifyPublished:process.env.GLD_VERIFY_PUBLISHED==='1',recoverCurrent:process.env.GLD_RECOVER_CURRENT==='1',
    ...(mode==='urgent'?{urgentScope:JSON.parse(process.env.GLD_URGENT_SCOPE??'null')}:{}),
  });
  console.log(JSON.stringify({mode,operations}));
  if (process.env.GITHUB_OUTPUT && mode !== 'commit') {
    await appendFile(process.env.GITHUB_OUTPUT,'changed='+result.changed+'\nwatermark='+(result.watermark===true)+'\ncutoff='+(result.cutoff??'')+'\n');
  }
  console.log(mode==='commit'?'Corte confirmado.':result.changed?'Paquetes listos para publicar.':'Paquetes sin cambios.');
}
