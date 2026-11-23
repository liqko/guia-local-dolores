#!/usr/bin/env node
'use strict';
// Paso 3: comparar identidades AST a través de cambios de líneas.
// Igualdad exacta del cuerpo y nombre de función en el mismo archivo,
// nunca equivalencia sólo por nombre o línea.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const rd=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const old=rd('baseline/auditorias/transversal/ARBOL_ACCIONES.json');
const newer=rd('nuevo/auditorias/transversal/ARBOL_ACCIONES.json');
const ledger=rd('auditorias/temporal/GRAFO_COMPLETO_1691.json');
const out='auditorias/temporal/REMAPPING_AST_989.json';
const changed=[...new Set(Object.keys(old.sourceHashes).filter(p=>newer.sourceHashes[p]&&newer.sourceHashes[p]!==old.sourceHashes[p]))].sort();
function parts(file,raw){
 if(!file.endsWith('.html'))return [{src:raw,off:0}];
 const result=[],re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let m;
 while((m=re.exec(raw)))if(!/\bsrc\s*=/.test(m[1]))
   result.push({src:m[2],off:raw.slice(0,m.index+m[0].indexOf('>')+1).split('\n').length-1});
 return result;
}
function tokensSha(text){
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text);
 const tokens=[];let kind;
 while((kind=scanner.scan())!==ts.SyntaxKind.EndOfFileToken)tokens.push([kind,scanner.getTokenText()]);
 return crypto.createHash('sha256').update(JSON.stringify(tokens)).digest('hex');
}
function scan(root,file){
 const raw=fs.readFileSync(path.join(root,file),'utf8'),found=[];
 for(const frag of parts(file,raw)){
  if(!frag.src.trim())continue;
  const sf=ts.createSourceFile(file,frag.src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const line=n=>frag.off+sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  const functionName=n=>{
    if(n.name&&ts.isIdentifier(n.name))return n.name.text;
    const p=n.parent;
    if((ts.isVariableDeclaration(p)||ts.isPropertyAssignment(p)||ts.isPropertyDeclaration?.(p))&&ts.isIdentifier(p.name))return p.name.text;
    if(ts.isBinaryExpression(p))return p.left.getText(sf).slice(0,140);
    if(ts.isCallExpression(p))return 'callback@'+line(n);
    if(ts.isParenthesizedExpression(p)&&ts.isCallExpression(p.parent))return 'iife@'+line(n);
    return 'anonymous@'+line(n);
  };
  const isFn=n=>ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n);
  function visit(n){
    if(isFn(n)){
      const name=functionName(n),id=file+':'+line(n)+':'+n.getStart(sf)+':'+name;
      const exact=crypto.createHash('sha256').update(n.getText(sf)).digest('hex');
      found.push({id,file,line:line(n),name,sha256:exact,tokenSha:tokensSha(n.getText(sf)),preview:n.getText(sf).slice(0,150)});
    }
    ts.forEachChild(n,visit);
  }
  visit(sf);
 }
 return found;
}
const original=new Map(),modern=new Map(),duplicates={};
for(const file of changed){
 const aa=scan('baseline',file),bb=scan('nuevo',file);
 const oldF=new Set(old.functionGraph.filter(f=>f.file===file).map(f=>f.id));
 const newF=new Set(newer.functionGraph.filter(f=>f.file===file).map(f=>f.id));
 const unrepresentedOld=aa.filter(x=>!oldF.has(x.id));
 const unrepresentedNew=bb.filter(x=>!newF.has(x.id));
 if(unrepresentedOld.length||unrepresentedNew.length)throw Error('AST scan not aligned '+file+' '+JSON.stringify({old:unrepresentedOld.slice(0,3),new:unrepresentedNew.slice(0,3)}));
 for(const x of aa)original.set(x.id,x);
 for(const x of bb)modern.set(x.id,x);
 duplicates[file]={historicas:aa.length,nuevas:bb.length};
}
const bySignature=new Map();
for(const x of modern.values()){
 const sig=x.file+':'+x.sha256;
 if(!bySignature.has(sig))bySignature.set(sig,[]);
 bySignature.get(sig).push(x);
}
// Segunda prueba estricta: tokens TypeScript idénticos, ignorando únicamente
// espacios y comentarios. Nunca se enlaza por nombre o proximidad.
const byTokens=new Map();
for(const x of modern.values()){
 const sig=x.file+':'+x.tokenSha;
 if(!byTokens.has(sig))byTokens.set(sig,[]);
 byTokens.get(sig).push(x);
}
const seenOldTokens=new Map();
for(const x of original.values()){
 const sig=x.file+':'+x.tokenSha;
 seenOldTokens.set(sig,(seenOldTokens.get(sig)||0)+1);
}
const seenOld=new Map();
for(const x of original.values()){
 const sig=x.file+':'+x.sha256;
 seenOld.set(sig,(seenOld.get(sig)||0)+1);
}
const oldTree=new Map(old.functionGraph.map(f=>[f.id,f]));
const newTree=new Map(newer.functionGraph.map(f=>[f.id,f]));
const mapped=new Map();
for(const f of old.functionGraph){
 if(!changed.includes(f.file)){
   if(newTree.has(f.id))mapped.set(f.id,{newId:f.id,proof:'identidad_AST_y_SHA_archivo_igual'});
   continue;
 }
 const orig=original.get(f.id);
 if(!orig)continue;
 const sig=orig.file+':'+orig.sha256;
 const candidates=bySignature.get(sig)||[];
 if(seenOld.get(sig)===1&&candidates.length===1){
   mapped.set(f.id,{newId:candidates[0].id,proof:'SHA256_cuerpo_AST_exacto_unico_mismo_archivo'});
 } else {
   const tokenSig=orig.file+':'+orig.tokenSha;
   const tokenCandidates=byTokens.get(tokenSig)||[];
   if(seenOldTokens.get(tokenSig)===1&&tokenCandidates.length===1)
     mapped.set(f.id,{newId:tokenCandidates[0].id,proof:'SHA256_tokens_TypeScript_identicos_sin_trivia_unico_mismo_archivo'});
 }
}
// Resolver callbacks con texto idéntico repetido sólo cuando su función
// contenedora conserva el cuerpo EXACTO y el orden de hijos por ámbito.
// Esto distingue callbacks iguales en receptores diferentes sin adivinar.
const ordinal=(id)=>Number(String(id).split(':')[2]||0);
const ambiguousBefore=[...mapped.keys()].length;
for(const [oldId,oldFn] of oldTree){
 if(mapped.has(oldId)||!changed.includes(oldFn.file))continue;
 const parentId=oldFn.parent,parentMap=parentId&&mapped.get(parentId)?.newId;
 const orig=original.get(oldId),origParent=parentId&&original.get(parentId);
 const currentParent=parentMap&&modern.get(parentMap);
 if(!orig||!origParent||!currentParent||origParent.sha256!==currentParent.sha256)continue;
 const siblingsOld=[...oldTree.values()].filter(v=>v.parent===parentId&&
   original.get(v.id)?.sha256===orig.sha256).sort((a,b)=>ordinal(a.id)-ordinal(b.id));
 const siblingsNew=[...newTree.values()].filter(v=>v.parent===parentMap&&
   modern.get(v.id)?.sha256===orig.sha256).sort((a,b)=>ordinal(a.id)-ordinal(b.id));
 if(!siblingsOld.length||siblingsOld.length!==siblingsNew.length)continue;
 const idx=siblingsOld.findIndex(v=>v.id===oldId);
 if(idx<0)continue;
 const candidate=siblingsNew[idx];
 if([...mapped.values()].some(v=>v.newId===candidate.id))continue;
 // El padre conserva la secuencia de expresiones exactamente; así la
 // posición ordinal de callbacks idénticos en el mismo ámbito es estable.
 mapped.set(oldId,{newId:candidate.id,
   proof:'callback_duplicado_en_padre_con_SHA_AST_exacto_y_ordinal_identico'});
}
const ordinalMatches=mapped.size-ambiguousBefore;
// Caso transformado, no equivalencia de cuerpo: el interceptor publicado
// sigue siendo la única asignación window.fetch de publicacion.js.
// Su rama RECLAMAR fue añadida; acreditar continuidad de receptor y cambio.
const legacyFetch='plataforma/publicacion.js:16:4686:window.fetch';
const legacy=original.get(legacyFetch);
const currentFetchCandidates=[...modern.values()].filter(x=>
 x.file==='plataforma/publicacion.js'&&x.name==='window.fetch');
const legacySrc=fs.readFileSync('baseline/plataforma/publicacion.js','utf8');
const currentSrc=fs.readFileSync('nuevo/plataforma/publicacion.js','utf8');
if(legacy&&!mapped.has(legacyFetch)&&currentFetchCandidates.length===1){
 const candidate=currentFetchCandidates[0];
 const assignment=/window\\.fetch\\s*=\\s*async\\s+function\\s*\\(input,init\\)/g;
 if([...legacySrc.matchAll(assignment)].length===1&&
    [...currentSrc.matchAll(assignment)].length===1&&
    legacy.sha256!==candidate.sha256&&
    !legacySrc.includes("String(body.modo||'').toUpperCase()==='RECLAMAR'")&&
    currentSrc.includes("String(body.modo||'').toUpperCase()==='RECLAMAR'")){
   mapped.set(legacyFetch,{newId:candidate.id,
      proof:'continuidad_receptor_window_fetch_y_firma_scoped_unicos_con_guarda_RECLAMAR_nueva',
      modifiedBody:true});
 }
}
const ledgerRows=ledger.funciones.map(r=>{
 const prev=oldTree.get(r.idAST);
 if(!prev)throw Error('Histórico faltante '+r.idAST);
 const m=mapped.get(r.idAST);
 return {oldId:r.idAST,newId:m?.newId||null,proof:m?.proof||null,modifiedBody:!!m?.modifiedBody,
   estadoHistorico:r.estado,archivo:prev.file,
   candidatoNoVerificado:!m&&original.has(r.idAST)?{
     nombre:original.get(r.idAST).name,
     candidatos:([...modern.values()].filter(x=>x.file===prev.file&&x.name===original.get(r.idAST).name).map(x=>x.id)).slice(0,8)
   }:null};
});
const original29=ledgerRows.filter(r=>!r.newId);
const transformEvidence=original29.map(r=>{
 const prev=original.get(r.oldId);
 const candidates=[...modern.values()].filter(x=>x.file===r.archivo&&
   (x.name===prev?.name || x.tokenSha===prev?.tokenSha));
 return {idASTHistorico:r.oldId,archivo:r.archivo,lineaHistorica:prev?.line,
   nombreHistorico:prev?.name,shaHistorico:prev?.sha256,tokenShaHistorico:prev?.tokenSha,
   cantidadCandidatos:candidates.length,
   candidatos:candidates.map(x=>({idActual:x.id,lineaActual:x.line,
     nombre:x.name,cuerpoIdentico:x.sha256===prev?.sha256,
     tokensIdenticos:x.tokenSha===prev?.tokenSha,
     fragmento:x.preview})).slice(0,30),
   dictamen:'identidad_no_acreditada; candidato nominal no constituye equivalencia'};
});
const oldUnlinked=ledgerRows.filter(r=>r.estadoHistorico==='falta_enlace_a_entrada');
const summary={
 corteHistorico:'e6362836e6078a14a361732d79a8212258934056',
 corteActualComparado:'9b7fd659e3b9f46e4a714955016df26ce3764c82',
 fuentesDistintas:changed,
 funcionesASTPorFuenteCambiada:duplicates,
 original1691:ledgerRows.length,
 original1691ConCuerpoOArchivoIdentico:ledgerRows.filter(x=>x.newId&&!x.modifiedBody).length,
 original1691SinCorrespondenciaExacta:ledgerRows.filter(x=>!x.newId).length,
 equivalenciasFuncionalesConCambioDeCuerpo:ledgerRows.filter(x=>x.modifiedBody).length,
 equivalenciasExactasOPorAmbitoInalterado:ledgerRows.filter(x=>x.newId&&!x.modifiedBody).length,
 remapeosCallbacksRepetidosConPadreExacto:ledgerRows.filter(x=>x.proof==='callback_duplicado_en_padre_con_SHA_AST_exacto_y_ordinal_identico').length,
 sinEnlaceHistorico:oldUnlinked.length,
 sinEnlaceHistoricoRemapeadasExactamente:oldUnlinked.filter(x=>x.newId).length,
 sinEnlaceHistoricoNoRemapeadas:oldUnlinked.filter(x=>!x.newId).length,
 saltoNetodeFuncionesAST:newer.functionGraph.length-old.functionGraph.length,
 comprobacion:'Identidad AST en archivo idéntico o SHA-256 único del cuerpo de función, no ejecución ni camino a AUD',
 saldoActualSinEnlace:null
};
if(summary.original1691!==1691||summary.sinEnlaceHistorico!==155)throw Error('Universo de comparación no coincide');
const fullMap=Object.fromEntries([...mapped.entries()].map(([oldId,v])=>[oldId,v]));
fs.writeFileSync(out,JSON.stringify({summary,ledger:ledgerRows,fullMap,transformEvidence},null,2)+'\n');
console.log('PASO3_REMAPEO_CUERPOS_989',JSON.stringify(summary));
console.log('PASO3_IDENTIDADES_TRANSFORMADAS',JSON.stringify(transformEvidence.map(x=>({oldId:x.idASTHistorico,archivo:x.archivo,prev:x.nombreHistorico,candidates:x.candidatos.map(c=>({id:c.idActual,token:c.tokensIdenticos,body:c.cuerpoIdentico}))}))).slice(0,30000));
