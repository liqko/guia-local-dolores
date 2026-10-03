import fs from "node:fs";
import path from "node:path";

const root=path.resolve("reconstruccion/worker");
const entry=path.join(root,"app-main-v10.js");
const seen=new Set();
const missing=[];
const forbidden=[];

const rules=[
  {name:"polling",re:/setInterval\s*\(/g},
  {name:"legacy territorio action",re:/api\(['"]territorios['"]/g},
  {name:"legacy resumen_ciudad",re:/resumen_ciudad/g},
  {name:"legacy ubicaciones",re:/action\s*[:=]\s*['"]ubicaciones['"]/g}
];

function walk(file){
  const abs=path.resolve(file);
  if(seen.has(abs))return;
  seen.add(abs);

  if(!fs.existsSync(abs)){missing.push(path.relative(root,abs));return;}
  const src=fs.readFileSync(abs,"utf8");

  for(const rule of rules){
    rule.re.lastIndex=0;
    if(rule.re.test(src))forbidden.push({file:path.relative(root,abs),rule:rule.name});
  }

  for(const m of src.matchAll(/from\s+["'](.+?)["']/g)){
    const rel=m[1];
    if(!rel.startsWith("."))continue;
    walk(path.resolve(path.dirname(abs),rel));
  }
}
walk(entry);

console.log("V10 reachable files:",seen.size);
if(missing.length){
  console.error("Missing imports:");
  for(const x of missing)console.error(" -",x);
}
if(forbidden.length){
  console.error("Forbidden patterns:");
  for(const x of forbidden)console.error(" -",x.file,x.rule);
}
if(missing.length||forbidden.length)process.exit(1);
console.log("AUDITORIA V10 OK");
