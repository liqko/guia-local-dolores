import fs from "node:fs";

const files=[
  "reconstruccion/worker/app-main-v25.js",
  "reconstruccion/worker/routes/panel-v12.js",
  "reconstruccion/worker/routes/public-v7.js",
  "reconstruccion/worker/modules/actividades-v3.js",
  "reconstruccion/worker/core/activities-read-model-v2.js",
  "reconstruccion/plataforma/login-modular-v8.html"
];
for(const f of files)if(!fs.existsSync(f))throw new Error("Falta "+f);

const ui=fs.readFileSync("reconstruccion/plataforma/login-modular-v8.html","utf8");
for(const token of ["actividadUpsertLocal_","actividadRemoveLocal_","promoUpsertLocal_","eventUpsertLocal_","freeEventUpsertLocal_"]){
  if(!ui.includes(token))throw new Error("Falta "+token);
}
const route=fs.readFileSync("reconstruccion/worker/routes/panel-v12.js","utf8");
if(!route.includes("activitySaveV3")||!route.includes("activityActionV3"))throw new Error("Panel no usa Actividades V3.");
const pub=fs.readFileSync("reconstruccion/worker/routes/public-v7.js","utf8");
if(!pub.includes("getActivitiesCityV2"))throw new Error("Publicación de Actividades no usa V2.");

console.log("AUDITORIA V25 OK");
