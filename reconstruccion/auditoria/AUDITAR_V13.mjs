import fs from "node:fs";
import path from "node:path";

const repo=process.cwd();
const entry=path.resolve(repo,"reconstruccion/worker/app-main-v13.js");
const html=path.resolve(repo,"reconstruccion/plataforma/granhermano-modular-v4.html");

const seen=new Set(),missing=[],issues=[];

const rules=[
  {name:"polling",re:/setInterval\s*\(/g},
  {name:"legacy resumen_ciudad",re:/resumen_ciudad/g},
  {name:"legacy ubicaciones",re:/action\s*[:=]\s*['"]ubicaciones['"]/g}
];

function walk(file){
  const abs=path.resolve(file);
  if(seen.has(abs))return;
  seen.add(abs);
  if(!fs.existsSync(abs)){missing.push(path.relative(repo,abs));return;}
  const src=fs.readFileSync(abs,"utf8");

  for(const rule of rules){
    rule.re.lastIndex=0;
    if(rule.re.test(src))issues.push({file:path.relative(repo,abs),issue:rule.name});
  }

  for(const m of src.matchAll(/from\s+["'](.+?)["']/g)){
    if(!m[1].startsWith("."))continue;
    walk(path.resolve(path.dirname(abs),m[1]));
  }
}
walk(entry);

if(!fs.existsSync(html)){
  missing.push(path.relative(repo,html));
}else{
  const src=fs.readFileSync(html,"utf8");
  const forbidden=[
    ["api pendientes",/api\(['"]pendientes['"]/],
    ["api resolver_pendiente",/api\(['"]resolver_pendiente['"]/],
    ["api buscar_eventos",/api\(['"]buscar_eventos['"]/],
    ["api territorios",/api\(['"]territorios['"]/],
    ["resumen_ciudad",/resumen_ciudad/]
  ];
  for(const [name,re] of forbidden)if(re.test(src))issues.push({file:path.relative(repo,html),issue:name});

  const required=[
    "/superadmin/moderation/pending",
    "/superadmin/moderation/resolve",
    "/superadmin/advertisers/",
    "/superadmin/territory",
    "/events-new?ciudad_id="
  ];
  for(const token of required){
    if(!src.includes(token))issues.push({file:path.relative(repo,html),issue:"falta "+token});
  }
}

console.log("V13 Worker files reachable:",seen.size);
if(missing.length){
  console.error("Missing files/imports:");
  for(const x of missing)console.error(" -",x);
}
if(issues.length){
  console.error("Architecture/UI issues:");
  for(const x of issues)console.error(" -",x.file,":",x.issue);
}
if(missing.length||issues.length)process.exit(1);
console.log("AUDITORIA V13 OK");
