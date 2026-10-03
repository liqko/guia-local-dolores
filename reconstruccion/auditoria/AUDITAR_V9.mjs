import fs from "node:fs";
import path from "node:path";

const root=path.resolve("reconstruccion/worker");
const entry=path.join(root,"app-main-v9.js");
const seen=new Set();
const missing=[];
const forbidden=[];
const forbiddenRules=[
  {name:"polling",re:/setInterval\s*\(/g},
  {name:"legacy territorio action",re:/api\(['"]territorios['"]/g},
  {name:"legacy resumen_ciudad",re:/resumen_ciudad/g},
  {name:"legacy ubicaciones",re:/action\s*[:=]\s*['"]ubicaciones['"]/g},
  {name:"Firestore write from public route",re:/routePublic[\s\S]{0,3000}db\.(patch|delete|listCollection|queryEqual|get)\s*\(/g}
];

function resolveImport(fromFile,rel){
  return path.resolve(path.dirname(fromFile),rel);
}
function walk(file){
  const abs=path.resolve(file);
  if(seen.has(abs))return;
  seen.add(abs);
  if(!fs.existsSync(abs)){missing.push(abs);return;}
  const src=fs.readFileSync(abs,"utf8");

  for(const rule of forbiddenRules){
    rule.re.lastIndex=0;
    for(const m of src.matchAll(rule.re)){
      forbidden.push({file:path.relative(root,abs),rule:rule.name,index:m.index});
    }
  }

  for(const m of src.matchAll(/from\s+["'](.+?)["']/g)){
    const rel=m[1];
    if(!rel.startsWith("."))continue;
    const target=resolveImport(abs,rel);
    if(!fs.existsSync(target))missing.push(path.relative(root,target));
    else walk(target);
  }
}

walk(entry);

if(missing.length){
  console.error("IMPORTS FALTANTES");
  for(const x of missing)console.error(" -",x);
}
if(forbidden.length){
  console.error("PATRONES PROHIBIDOS");
  for(const x of forbidden)console.error(` - ${x.file}: ${x.rule}`);
}
console.log("Archivos alcanzables desde V9:",seen.size);

if(missing.length||forbidden.length)process.exit(1);
console.log("AUDITORIA V9 OK");
