import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import bookTools from '../plataforma/paquete-ciudad.js';

const { applyDelta, idOf, schemaOf, validBook } = bookTools;
const marker = '/* GLD_CITY_BOOKS */ {}';
const publicPath = 'plataforma/paquetes-ciudad';
const dayMs = 86400000;
const offsetMs = 4 * 3600000;
const historyLimit = 14;

export function ultimoCorte(now = Date.now()) {
  return Math.floor((now - offsetMs) / dayMs) * dayMs + offsetMs;
}

function requireCut(cut) {
  if (!Number.isSafeInteger(cut) || ultimoCorte(cut) !== cut) throw Error('Corte de publicación inválido');
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw Error('Manifiesto inválido');
  for (const [city, entry] of Object.entries(manifest)) {
    if (!city.trim() || entry?.key !== Buffer.from(city).toString('base64url') ||
        !Number.isSafeInteger(entry.revision) || entry.revision < 1 || !Array.isArray(entry.deltas) ||
        entry.deltas.some(revision => !Number.isSafeInteger(revision) || revision < 1 || revision >= entry.revision) ||
        new Set(entry.deltas).size !== entry.deltas.length) throw Error('Versión publicada inválida');
  }
}

function moduleChange(before, after, name) {
  const {field,id:idField}=schemaOf(after)[name];
  const { [field]: oldRows, ...oldMetadata } = (before.modules[name]??{success:true,[field]:[]});
  const { [field]: newRows, ...metadata } = after.modules[name];
  const oldIds = new Map(oldRows.map(row => [idOf(row, idField), row]));
  const newIds = new Set(newRows.map(row => idOf(row, idField)));
  if (oldIds.has('') || oldIds.size !== oldRows.length || newIds.has('') || newIds.size !== newRows.length) {
    throw Error('Identificadores inválidos en paquete público');
  }
  const upsert = newRows.filter(row => !isDeepStrictEqual(oldIds.get(idOf(row,idField)),row));
  const remove = [...oldIds.keys()].filter(id => !newIds.has(id));
  if (upsert.length || remove.length || !isDeepStrictEqual(oldMetadata,metadata)) {
    return {upsert,remove,metadata};
  }
}

function publicChanges(before, batch) {
  for (const [name, change] of Object.entries(batch.changes ?? {})) {
    if (!Object.hasOwn(schemaOf(batch.schema?{schema:batch.schema}:before),name)) throw Error('Módulo de publicación inválido');
    const allowedMetadata = schemaOf(batch.schema?{schema:batch.schema}:before)[name].metadata;
    if (Object.keys(change?.metadata ?? {}).some(key => !allowedMetadata.includes(key))) {
      throw Error('Metadatos ajenos a la Guía pública');
    }
    if (change?.metadata?.ciudad_id !== undefined && change.metadata.ciudad_id !== before.city) {
      throw Error('Los metadatos corresponden a otra ciudad');
    }
  }
  const next = applyDelta(before,batch);
  const changes = {};
  for (const name of Object.keys(batch.changes)) {
    const change = moduleChange(before,next,name);
    if (change) changes[name] = change;
  }
  return {next,changes};
}

function combineChanges(earlier, latest, schema) {
  const result = {...earlier};
  for (const [name, change] of Object.entries(latest)) {
    const idField = schema[name].id;
    const prior = earlier[name];
    if (!prior) {
      result[name] = change;
      continue;
    }
    const upsert = new Map(prior.upsert.map(row => [idOf(row,idField),row]));
    const remove = new Set(prior.remove);
    for (const id of change.remove) {
      upsert.delete(id);
      remove.add(id);
    }
    for (const row of change.upsert) {
      const id = idOf(row,idField);
      upsert.set(id,row);
      // Keep a prior deletion so the browser reinserts the row at its new position.
    }
    result[name] = {upsert:[...upsert.values()],remove:[...remove],metadata:change.metadata};
  }
  return result;
}

// source is produced by the public projection export. A missing or partial cut
// must fail instead of treating an unavailable city as a day with no changes.
export function ghCityMembership219(book){
 const groups={revision:book.revision,eventos_vip:[],eventos_free:[],actividades:[],publicidad:[]};
 const sets=Object.fromEntries(Object.keys(groups).filter(k=>k!=='revision').map(k=>[k,new Set()]));
 for(const [name,spec] of Object.entries(schemaOf(book))){
  if(name!=='events'&&name!=='activities'&&name!=='ads'&&spec.family!=='ads'&&!name.startsWith('ads_'))continue;
  for(const row of book.modules[name]?.[spec.field]||[]){
   const id=idOf(row,spec.id);if(!id)throw Error('Identidad de publicación inválida');
   sets[name==='events'?(String(row.nivel||'').toUpperCase()==='FREE'?'eventos_free':'eventos_vip'):name==='activities'?'actividades':'publicidad'].add(id);
  }
 }
 for(const [key,ids] of Object.entries(sets))groups[key]=[...ids].sort();
 return groups;
}
export async function aplicarCorte({ previous, source, readPublished, stage, forceStage = false, reusePublished = false, ghSummaryPath }) {
  requireCut(previous.cutoff);
  requireCut(source.cutoff);
  validateManifest(previous.manifest);
  if(source.recoveredAt!==undefined&&(!Number.isSafeInteger(source.recoveredAt)||source.recoveredAt<source.cutoff||source.recoveredAt>=source.cutoff+dayMs||source.urgent||source.cutoff<=source.after))throw Error('Fecha de recuperación inválida');
  if (source.complete !== true || source.after !== previous.cutoff ||
      source.cutoff < source.after || !Array.isArray(source.cities)) throw Error('Corte incompleto o fuera de secuencia');

  const manifest = structuredClone(previous.manifest);
  const seen = new Set();
  const files = new Map();
  const unchangedBooks = new Map();
  const initial = source.initial ?? [], retired = source.retired ?? [];
  const urgent = source.urgent === true;
  if (urgent && (source.cutoff !== source.after || initial.length || retired.length || source.schema)) {
    throw Error('Una publicación urgente sólo aplica diferencias de registros a la edición vigente');
  }
  if (!Array.isArray(initial)||!Array.isArray(retired)||(source.cutoff===source.after&&(initial.length||retired.length))) {
    throw Error('Altas o bajas de ciudades inválidas');
  }
  for (const city of retired) {
    if (typeof city!=='string'||!Object.hasOwn(manifest,city)||seen.has(city)) throw Error('Baja de ciudad inválida');
    seen.add(city);
    delete manifest[city];
  }
  for (const book of initial) {
    const city=book?.city;
    if (typeof city!=='string'||!city.trim()||Object.hasOwn(manifest,city)||seen.has(city)||!validBook(book,city)) {
      throw Error('Paquete inicial de ciudad inválido');
    }
    seen.add(city);
    const key=Buffer.from(city).toString('base64url');
    Object.defineProperty(manifest,city,{value:{key,revision:book.revision,deltas:[]},enumerable:true,writable:true,configurable:true});
    files.set(publicPath+'/'+key+'/completo-'+book.revision+'.json',book);
  }
  for (const input of source.cities) {
    const city = input?.city;
    if (typeof city !== 'string' || !Object.hasOwn(manifest,city) || seen.has(city) || (!urgent && source.cutoff === source.after)) {
      throw Error('Ciudad o secuencia inválida en el corte');
    }
    seen.add(city);
    const old = manifest[city];
    if (urgent && (input.from !== old.revision || Object.keys(input.replacements ?? {}).length)) {
      throw Error('La diferencia urgente no corresponde a la revisión publicada');
    }
    const prefix = publicPath + '/' + old.key + '/';
    const completePath = prefix + 'completo-' + old.revision + '.json';
    const book = await readPublished(completePath);
    if (!validBook(book,city) || book.revision !== old.revision) throw Error('Paquete publicado inválido');
    const revision = old.revision + 1;
    const targetSchema=source.schema??book.schema;
    const descriptors=schemaOf(targetSchema?{schema:targetSchema}:book);
    const changesInput={...input.changes};
    for (const [name,replacement] of Object.entries(input.replacements??{})) {
      if (!Object.hasOwn(descriptors,name)||Object.hasOwn(changesInput,name)) throw Error('Módulo público duplicado o inválido');
      const modules={...book.modules};
      for(const [key,{field}] of Object.entries(descriptors))if(!modules[key])modules[key]={success:true,[field]:[]};
      const replaced={...book,...(targetSchema?{schema:targetSchema}:{}),modules:{...modules,[name]:replacement}};
      if (!validBook(replaced,city)) throw Error('Reemplazo público inválido');
      const delta=moduleChange(book,replaced,name);
      if (delta) {
        delete delta.metadata.success;
        changesInput[name]=delta;
      }
    }
    const {next,changes} = publicChanges(book,{city,from:old.revision,revision,changes:changesInput,...(targetSchema?{schema:targetSchema}:{})});
    const schemaChanged=!isDeepStrictEqual(book.schema,next.schema);
    if (!Object.keys(changes).length&&!schemaChanged) {
      unchangedBooks.set(completePath,book);
      continue;
    }

    const keep = [...old.deltas,old.revision].sort((a,b)=>a-b).slice(-historyLimit);
    files.set(prefix + 'completo-' + revision + '.json',next);
    for (const from of keep) {
      let combined = changes;
      if (from !== old.revision) {
        const delta = await readPublished(prefix + 'cambios-' + from + '-' + old.revision + '.json');
        if (delta?.city !== city || delta.from !== from || delta.revision !== old.revision || !delta.changes) {
          throw Error('Diferencia publicada inválida');
        }
        combined = combineChanges(delta.changes,changes,descriptors);
      }
      files.set(prefix + 'cambios-' + from + '-' + revision + '.json',{city,from,revision,changes:combined,...(next.schema?{schema:next.schema}:{})});
    }
    old.revision = revision;
    old.deltas = keep;
  }

  const changed = files.size > 0 || retired.length > 0;
  if (changed || forceStage) {
    const catalogPath = join(stage,'plataforma','territorio-cache.js');
    if (!urgent || !reusePublished) {
      const catalog = await readFile(catalogPath,'utf8');
      if (catalog.split(marker).length !== 2) throw Error('Marcador de paquetes inválido');
      const expression = 'JSON.parse(' + JSON.stringify(JSON.stringify(manifest)) + ')';
      await writeFile(catalogPath,catalog.replace(marker,()=> '/* GLD_CITY_BOOKS */ ' + expression));
    }
    for (const {key,revision,deltas} of Object.values(manifest)) {
      const prefix = publicPath + '/' + key + '/';
      await mkdir(join(stage,prefix),{recursive:true});
      for (const name of ['completo-' + revision,...deltas.map(from=>'cambios-' + from + '-' + revision)]) {
        const file = prefix + name + '.json';
        if (reusePublished && !files.has(file)) continue;
        const content = files.get(file) ?? unchangedBooks.get(file) ?? await readPublished(file);
        await writeFile(join(stage,file),JSON.stringify(content));
      }
    }
    await mkdir(join(stage,publicPath),{recursive:true});
    await writeFile(join(stage,publicPath,'publicacion.json'),JSON.stringify({cutoff:source.cutoff,manifest,...((source.schema??previous.schema)?{schema:source.schema??previous.schema}:{}),...((source.recoveredAt??(source.cutoff===source.after?previous.recoveredAt:undefined))===undefined?{}:{recoveredAt:source.recoveredAt??previous.recoveredAt})}));
  }
  if(ghSummaryPath){
    const cities=Object.create(null),prior=source.gh_summary?.cities??{};
    for(const [city,{key,revision}] of Object.entries(manifest)){
      const path=publicPath+'/'+key+'/completo-'+revision+'.json';
      const book=files.get(path)??unchangedBooks.get(path);
      if(!book&&Object.hasOwn(prior,city)&&prior[city].revision===revision){cities[city]=prior[city];continue;}
      const installed=book??await readPublished(path);
      if(!validBook(installed,city)||installed.revision!==revision)throw Error('Paquete del resumen publicado inválido');
      cities[city]=ghCityMembership219(installed);
    }
    await writeFile(ghSummaryPath,JSON.stringify({cutoff:source.cutoff,cities}),{mode:0o600});
  }
  return {changed,cutoff:source.cutoff,manifest};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [stage, baselinePath, sourcePath, previousBase] = process.argv.slice(2);
  if (!stage || !baselinePath || !sourcePath || !previousBase) throw Error('Faltan entradas de publicación');
  const [previous,source] = await Promise.all([baselinePath,sourcePath].map(async file => JSON.parse(await readFile(file,'utf8'))));
  const readPublished = async file => {
    const response = await fetch(new URL(file,previousBase),{signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('Paquete publicado no disponible');
    return response.json();
  };
  const result = await aplicarCorte({previous,source,readPublished,stage,forceStage:process.env.GLD_STAGE_UNCHANGED==='1'});
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,'changed=' + result.changed + '\n');
  console.log(result.changed ? 'Corte preparado' : 'El corte no cambia los paquetes públicos');
}
