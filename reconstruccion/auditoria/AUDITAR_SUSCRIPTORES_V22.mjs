import fs from "node:fs";
import path from "node:path";

const repo=process.cwd();
const files=[
  "reconstruccion/plataforma/suscriptores-v2.html",
  "reconstruccion/plataforma/carcasa-territorio-v2.html",
  "reconstruccion/plataforma/anunciantes-publico-v3.html",
  "reconstruccion/worker/app-main-v22.js",
  "reconstruccion/worker/routes/panel-v9.js",
  "reconstruccion/worker/routes/panel-v8.js",
  "reconstruccion/worker/routes/panel-v6.js",
  "reconstruccion/worker/modules/suscriptor-login-v2.js",
  "reconstruccion/worker/modules/suscriptor-registro-v3.js",
  "reconstruccion/worker/modules/suscriptor-mail-v2.js",
  "reconstruccion/worker/modules/suscriptor-cuenta-v2.js",
  "reconstruccion/worker/modules/suscriptor-delete-v2.js",
  "reconstruccion/worker/modules/suscriptor-favoritos-v2.js",
  "reconstruccion/worker/core/subscriber-index-v2.js"
];

const issues=[];
for(const rel of files){
  const abs=path.resolve(repo,rel);
  if(!fs.existsSync(abs)){issues.push(rel+": faltante");continue;}
  const src=fs.readFileSync(abs,"utf8");

  if(/gld_suscriptor_session_v1/.test(src))issues.push(rel+": session key vieja");
  if(/action\s*:\s*['"]actualizar_ciudad['"][\s\S]{0,220}suscriptor_id\s*:/.test(src)){
    issues.push(rel+": actualizar_ciudad confía en suscriptor_id del frontend");
  }
  if(/action\s*:\s*['"](agregar_favorito|quitar_favorito)['"][\s\S]{0,260}suscriptor_id\s*:/.test(src)){
    issues.push(rel+": favoritos confían en suscriptor_id del frontend");
  }
  if(/action\s*:\s*['"]eliminar_cuenta['"][\s\S]{0,260}suscriptor_id\s*:/.test(src)){
    issues.push(rel+": baja confía en suscriptor_id del frontend");
  }
}

const expected={
  "reconstruccion/plataforma/suscriptores-v2.html":[
    "gld_suscriptor_token_v2",
    "Authorization:'Bearer '+token",
    "action:'solicitar_verificacion'",
    "action:'confirmar_verificacion'",
    "action:'solicitar_recuperacion'",
    "action:'restablecer_clave'"
  ],
  "reconstruccion/plataforma/carcasa-territorio-v2.html":[
    "gld_suscriptor_token_v2",
    "action:'actualizar_ciudad'",
    "tipo:'CIUDAD'"
  ],
  "reconstruccion/worker/routes/panel-v8.js":[
    'action==="login"',
    'action==="crear"',
    'action==="actualizar_ciudad"',
    'action==="actualizar_perfil"'
  ],
  "reconstruccion/worker/routes/panel-v9.js":[
    'action==="eliminar_cuenta"'
  ]
};

for(const [rel,tokens] of Object.entries(expected)){
  const src=fs.readFileSync(path.resolve(repo,rel),"utf8");
  for(const token of tokens)if(!src.includes(token))issues.push(rel+": falta "+token);
}

console.log("Archivos auditados:",files.length);
if(issues.length){
  console.error("Problemas:");
  for(const x of issues)console.error(" -",x);
  process.exit(1);
}
console.log("AUDITORIA SUSCRIPTORES V22 OK");
