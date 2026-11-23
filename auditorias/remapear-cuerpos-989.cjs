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
      found.push({id,file,line:line(n),name,sha256:exact,preview:n.getText(sf).slice(0,150)});
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
 if(seenOld.get(sig)===1&&candidates.length===1)
   mapped.set(f.id,{newId:candidates[0].id,proof:'SHA256_cuerpo_AST_exacto_unico_mismo_archivo'});
}
const ledgerRows=ledger.funciones.map(r=>{
 const prev=oldTree.get(r.idAST);
 if(!prev)throw Error('Histórico faltante '+r.idAST);
 const m=mapped.get(r.idAST);
 return {oldId:r.idAST,newId:m?.newId||null,proof:m?.proof||null,
   estadoHistorico:r.estado,archivo:prev.file,
   candidatoNoVerificado:!m&&original.has(r.idAST)?{
     nombre:original.get(r.idAST).name,
     candidatos:([...modern.values()].filter(x=>x.file===prev.file&&x.name===original.get(r.idAST).name).map(x=>x.id)).slice(0,8)
   }:null};
});
const oldUnlinked=ledgerRows.filter(r=>r.estadoHistorico==='falta_enlace_a_entrada');
const summary={
 corteHistorico:'e6362836e6078a14a361732d79a8212258934056',
 corteActualComparado:'9b7fd659e3b9f46e4a714955016df26ce3764c82',
 fuentesDistintas:changed,
 funcionesASTPorFuenteCambiada:duplicates,
 original1691:ledgerRows.length,
 original1691ConCuerpoOArchivoIdentico:ledgerRows.filter(x=>x.newId).length,
 original1691SinCorrespondenciaExacta:ledgerRows.filter(x=>!x.newId).length,
 sinEnlaceHistorico:oldUnlinked.length,
 sinEnlaceHistoricoRemapeadasExactamente:oldUnlinked.filter(x=>x.newId).length,
 sinEnlaceHistoricoNoRemapeadas:oldUnlinked.filter(x=>!x.newId).length,
 saltoNetodeFuncionesAST:newer.functionGraph.length-old.functionGraph.length,
 comprobacion:'Identidad AST en archivo idéntico o SHA-256 único del cuerpo de función, no ejecución ni camino a AUD',
 saldoActualSinEnlace:null
};
if(summary.original1691!==1691||summary.sinEnlaceHistorico!==155)throw Error('Universo de comparación no coincide');
fs.writeFileSync(out,JSON.stringify({summary,ledger:ledgerRows},null,2)+'\n');
console.log('PASO3_REMAPEO_CUERPOS_989',JSON.stringify(summary));
