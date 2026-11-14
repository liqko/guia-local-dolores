import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { aplicarCorte, ultimoCorte } from './aplicar-corte-paquetes-ciudad.mjs';

const worker = 'https://login.liqkoargentina.workers.dev/internal/city-books';
const hosting = 'https://anunciantes-guialocal.web.app/';
const audience = 'guialocal:publicacion-ciudades';

export function publicationCutoff(value=process.env.GLD_PUBLICATION_CUTOFF) {
  if(value===undefined||value==='')return ultimoCorte();
  const cutoff=Number(value);
  if(!Number.isSafeInteger(cutoff)||ultimoCorte(cutoff)!==cutoff||cutoff>ultimoCorte())throw Error('Corte fijo del trabajo diario inválido');
  return cutoff;
}

// Retry only idempotent publication operations, retaining the exact request
// and cutoff. Authentication/validation errors must never be retried.
export async function publicationRequest(read, url, options = {}, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const {allowMissing = false, ...requestOptions} = options;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await read(url, {...requestOptions, redirect:'error', signal:AbortSignal.timeout(90000)});
    } catch (error) {
      if (attempt === 2) throw error;
      await pause(250 * (attempt + 1));
      continue;
    }
    if (response.status === 404 && allowMissing) return null;
    if (response.ok) return response.json();
    const transient = response.status === 429 || response.status >= 500;
    await response.body?.cancel();
    if (!transient || attempt === 2) throw Error('No se pudo completar la publicación (HTTP ' + response.status + ')');
    await pause(250 * (attempt + 1));
  }
}
const readJson = publicationRequest;
export function requirePublication207(data, cutoff, status) {
  if (data?.publication?.build !== '207-arranque-recuperable-2' ||
      data.publication.cutoff !== cutoff || data.publication.status !== status) {
    throw Error('La publicación no confirmó la revisión207, el corte y el estado esperados. No continuar la instalación.');
  }
}

export async function githubIdentity(read) {
  const {ACTIONS_ID_TOKEN_REQUEST_URL:url,ACTIONS_ID_TOKEN_REQUEST_TOKEN:token} = process.env;
  if (!url || !token) throw Error('Falta identidad del trabajo de publicación');
  const target = new URL(url);
  if (target.protocol !== 'https:') throw Error('URL de identidad inválida');
  target.searchParams.set('audience',audience);
  const data = await readJson(read,target,{headers:{Authorization:'Bearer '+token}});
  if (typeof data?.value !== 'string') throw Error('Identidad de publicación inválida');
  return data.value;
}

export async function publicarPaquetes({mode,stage,forceStage=false,cutoff=publicationCutoff(),read=fetch,
  identity=githubIdentity}) {
  const call = async (body,allowMissing=false) => readJson(read,worker,{
    method:'POST',allowMissing,
    headers:{Authorization:'Bearer '+await identity(read),'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if (mode === 'commit') {
    const result = await call({op:'commit',cutoff});
    if (result?.success !== true) throw Error('El último corte no quedó confirmado');
    requirePublication207(result,cutoff,'committed');
    if (result.private_daily?.status === 'pending') throw Error('El corte público quedó confirmado, pero falta preparar Gran Hermano. Reintentá el mismo publicador; no hace falta volver a publicar desde el panel.');
    return {cutoff};
  }
  if (!['cut','preserve'].includes(mode) || !stage) throw Error('Modo de publicación inválido');
  const previous = await readJson(read,new URL('plataforma/paquetes-ciudad/publicacion.json',hosting),{allowMissing:true});
  if (mode === 'preserve' && !previous) return {changed:false};
  const manifest = previous?.manifest ?? {};
  const readPublished = path => readJson(read,new URL(path,hosting));
  if (mode === 'preserve') {
    return aplicarCorte({previous,
      source:{after:previous.cutoff,cutoff:previous.cutoff,complete:true,cities:[]},
      readPublished,stage,forceStage:true});
  }

  const source = await call({op:'read',cutoff,publishedCutoff:previous?.cutoff??null,known:Object.keys(manifest),...(previous?.schema?{schema:previous.schema}:{})},!previous);
  if (!source) throw Error('Falta la edición preparada; no se confirma ni se publica una copia vacía.');
  requirePublication207(source,cutoff,'staged');
  if (source.cutoff !== cutoff || !Number.isSafeInteger(source.after) ||
      (previous && source.after < previous.cutoff)) throw Error('El Worker devolvió otro corte');
  return aplicarCorte({previous:{cutoff:source.after,manifest},source,readPublished,stage,forceStage});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode,stage,cutoff] = process.argv.slice(2);
  const result = await publicarPaquetes({mode,stage,
    ...(cutoff?{cutoff:Number(cutoff)}:{}),forceStage:process.env.GLD_STAGE_UNCHANGED==='1'});
  if (process.env.GITHUB_OUTPUT && mode !== 'commit') {
    await appendFile(process.env.GITHUB_OUTPUT,'changed='+result.changed+'\ncutoff='+(result.cutoff??'')+'\n');
  }
  console.log(mode==='commit'?'Corte confirmado.':result.changed?'Paquetes listos para publicar.':'Paquetes sin cambios.');
}
