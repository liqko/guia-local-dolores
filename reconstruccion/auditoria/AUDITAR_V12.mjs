import fs from "node:fs";
import path from "node:path";

const repo=process.cwd();
const workerRoot=path.resolve(repo,"reconstruccion/worker");
const entry=path.join(workerRoot,"app-main-v12.js");
const htmlPath=path.resolve(repo,"reconstruccion/plataforma/granhermano-modular-v4.html");

const seen=new Set();
const missing=[];
const forbidden=[];

const workerRules=[
  {name:"polling",re:/setInterval\s*\(/g},
  {name:"legacy resumen_ciudad",re:/resumen_ciudad/g},
  {name:"legacy ubicaciones",re:/action\s*[:=]\s*['"]ubicaciones['"]/g}
];

function walk(file){
  const abs=path.resolve(file);
  if(seen.has(abs))return;
  seen.add(abs);

  if(!fs.existsSync(abs)){
    missing.push(path.relative(repo,abs));
    return;
  }

  const src=fs.readFileSync(abs,"utf8");
  for(const rule of workerRules){
    rule.re.lastIndex=0;
    if(rule.re.test(src))forbidden.push({file:path.relative(repo,abs),rule:rule.name});
  }

  for(const m of src.matchAll(/from\s+["'](.+?)["']/g)){
    const rel=m[1];
    if(!rel.startsWith("."))continue;
    walk(path.resolve(path.dirname(abs),rel));
  }
}
walk(entry);

if(!fs.existsSync(htmlPath)){
  missing.push(path.relative(repo,htmlPath));
}else{
  const html=fs.readFileSync(htmlPath,"utf8");
  const htmlRules=[
    {name:"pendientes legacy",re:/api\(['"]pendientes['"]/},
    {name:"resolver pendiente legacy",re:/api\(['"]resolver_pendiente['"]/},
    {name:"buscar eventos legacy",re:/api\(['"]buscar_eventos['"]/},
    {name:"territorio legacy",re:/api\(['"]territorios['"]/},
    {name:"resumen ciudad legacy",re:/resumen_ciudad/}
  ];
  for(const rule of htmlRules){
    if(rule.re.test(html))forbidden.push({file:path.relative(repo,htmlPath),rule:rule.name});
  }

  const required=[
    "/superadmin/moderation/pending",
    "/superadmin/moderation/resolve",
    "/events-new?ciudad_id=",
    "/superadmin/advertisers/",
    "/superadmin/territory"
  ];
  for(const token of required){
    if(!html.includes(token))forbidden.push({file:path.relative(repo,htmlPath),rule:"falta endpoint requerido "+token});
  }
}

console.log("V12 reachable Worker files:",seen.size);

if(missing.length){
  console.error("IMPORTS/ARCHIVOS FALTANTES");
  for(const x of missing)console.error(" -",x);
}
if(forbidden.length){
  console.error("PATRONES PROHIBIDOS / REQUISITOS AUSENTES");
  for(const x of forbidden)console.error(" -",x.file,":",x.rule);
}
if(missing.length||forbidden.length)process.exit(1);

console.log("AUDITORIA V12 OK");
