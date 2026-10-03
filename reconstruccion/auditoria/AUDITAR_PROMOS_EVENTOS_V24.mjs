import fs from "node:fs";

const required=[
  "reconstruccion/worker/app-main-v24.js",
  "reconstruccion/worker/routes/panel-v11.js",
  "reconstruccion/worker/routes/panel-v10.js",
  "reconstruccion/worker/routes/panel-v4.js",
  "reconstruccion/worker/modules/promos-v2.js",
  "reconstruccion/worker/modules/promos-panel-v3.js",
  "reconstruccion/worker/modules/eventos-v3.js",
  "reconstruccion/worker/modules/eventos-panel-v2.js",
  "reconstruccion/plataforma/login-modular-v7.html"
];

for(const f of required){
  if(!fs.existsSync(f))throw new Error("Falta "+f);
}

const panel=fs.readFileSync("reconstruccion/worker/routes/panel-v4.js","utf8");
if(!panel.includes("events:rows,eventos:rows,rows"))throw new Error("Eventos no mantiene shape compatible.");

const ui=fs.readFileSync("reconstruccion/plataforma/login-modular-v7.html","utf8");
for(const token of ["promoUpsertLocal_","promoRemoveLocal_","eventUpsertLocal_","eventRemoveLocal_","freeEventUpsertLocal_","freeEventRemoveLocal_"]){
  if(!ui.includes(token))throw new Error("Falta actualización local "+token);
}
if((ui.match(/await loadPromosUI\(\)/g)||[]).length!==0){
  throw new Error("Promos todavía recarga el módulo después de mutaciones.");
}
console.log("AUDITORIA PROMOS/EVENTOS V24 OK");
