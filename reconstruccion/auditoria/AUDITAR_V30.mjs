import fs from "node:fs";

const mustExist=[
  "reconstruccion/worker/app-main-v30.js",
  "reconstruccion/worker/routes/panel-v15.js",
  "reconstruccion/worker/routes/public-v12.js",
  "reconstruccion/worker/modules/farmacias-v3.js",
  "reconstruccion/worker/modules/farmacias-public-v3.js",
  "reconstruccion/worker/core/farmacias-read-model-v2.js",
  "reconstruccion/worker/modules/efemerides-v3.js",
  "reconstruccion/worker/core/efemerides-read-model-v2.js",
  "reconstruccion/worker/modules/publicidad-v4.js",
  "reconstruccion/worker/core/publicity-read-model-v2.js",
  "reconstruccion/worker/modules/actividades-v3.js",
  "reconstruccion/worker/core/activities-read-model-v2.js",
  "reconstruccion/plataforma/login-modular-v11.html",
  "reconstruccion/plataforma/promos-public-v1.html",
  "reconstruccion/plataforma/eventos-public-v1.html",
  "reconstruccion/plataforma/actividades-public-v1.html",
  "reconstruccion/plataforma/farma-turnos-public-v1.html"
];
for(const f of mustExist){
  if(!fs.existsSync(f))throw new Error("Falta "+f);
}

const app=fs.readFileSync("reconstruccion/worker/app-main-v30.js","utf8");
if(!app.includes('version:"30"'))throw new Error("Entrypoint no es V30.");
if(!app.includes('routePublicV12'))throw new Error("V30 no usa public-v12.");
if(!app.includes('routePanelV15'))throw new Error("V30 no usa panel-v15.");

const panel=fs.readFileSync("reconstruccion/worker/routes/panel-v15.js","utf8");
if(!panel.includes("farmSaveCycleV3"))throw new Error("Farmacias no usa guardado V3.");

const farmPublic=fs.readFileSync("reconstruccion/worker/modules/farmacias-public-v3.js","utf8");
if(!farmPublic.includes("farmacias_por_turno"))throw new Error("Farmacias pública no calcula simultáneas.");
if(!farmPublic.includes("turnosForCycle"))throw new Error("Farmacias pública no calcula turnos.");

const ui=fs.readFileSync("reconstruccion/plataforma/login-modular-v11.html","utf8");
for(const token of [
  "promoUpsertLocal_",
  "eventUpsertLocal_",
  "freeEventUpsertLocal_",
  "actividadUpsertLocal_",
  "pubUiUpsertLocal_",
  "efemUpsertLocal_"
]){
  if(!ui.includes(token))throw new Error("Panel incompleto: falta "+token);
}

const eventos=fs.readFileSync("reconstruccion/plataforma/eventos-public-v1.html","utf8");
if(eventos.includes("CITIES_ENDPOINT"))throw new Error("Eventos público conserva getcities innecesario.");

const farmHtml=fs.readFileSync("reconstruccion/plataforma/farma-turnos-public-v1.html","utf8");
if(!farmHtml.includes("Array.isArray(b.media)"))throw new Error("Farmacias público no soporta publicidad preparada.");

const runtimeFiles=[
  "reconstruccion/worker/modules/farmacias-panel-v3.js",
  "reconstruccion/worker/modules/commerce-v3.js",
  "reconstruccion/worker/modules/promos-v2.js",
  "reconstruccion/worker/modules/eventos-v3.js",
  "reconstruccion/worker/modules/actividades-v3.js",
  "reconstruccion/worker/modules/publicidad-v4.js",
  "reconstruccion/worker/modules/efemerides-v3.js"
];
for(const f of runtimeFiles){
  const src=fs.readFileSync(f,"utf8");
  if(src.includes("listCollection("))throw new Error("Scan global en operación normal: "+f);
}

console.log("AUDITORIA INTEGRADA V30 OK");
