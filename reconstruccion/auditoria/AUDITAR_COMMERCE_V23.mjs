import fs from "node:fs";
const required=[
  "reconstruccion/worker/app-main-v23.js",
  "reconstruccion/worker/routes/panel-v10.js",
  "reconstruccion/worker/modules/commerce-v3.js",
  "reconstruccion/worker/core/commerce-cache-patch-v2.js",
  "reconstruccion/plataforma/login-modular-v4.html"
];
for(const f of required){
  if(!fs.existsSync(f))throw new Error("Falta "+f);
}
const html=fs.readFileSync("reconstruccion/plataforma/login-modular-v4.html","utf8");
if(html.includes("Lectura posterior para dejar formulario y baseline exactamente como quedaron guardados.")){
  throw new Error("Commerce sigue recargando todo después de guardar.");
}
const route=fs.readFileSync("reconstruccion/worker/routes/panel-v10.js","utf8");
for(const token of ["commerceSetDatosV3","commerceSetSedesV3","commerceDeleteSedeV3"]){
  if(!route.includes(token))throw new Error("Falta "+token);
}
console.log("AUDITORIA COMMERCE V23 OK");
