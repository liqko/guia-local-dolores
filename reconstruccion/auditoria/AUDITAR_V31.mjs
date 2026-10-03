import fs from "node:fs";

const required=[
  "reconstruccion/worker/app-main-v31.js",
  "reconstruccion/worker/routes/admin-v11.js",
  "reconstruccion/worker/modules/moderacion-general-v3.js",
  "reconstruccion/plataforma/granhermano-v2.html"
];
for(const f of required)if(!fs.existsSync(f))throw new Error("Falta "+f);

const app=fs.readFileSync("reconstruccion/worker/app-main-v31.js","utf8");
if(!app.includes('version:"31"'))throw new Error("Entrypoint no es V31.");
if(!app.includes("routeAdminV11"))throw new Error("V31 no integra Admin V11.");

const mod=fs.readFileSync("reconstruccion/worker/modules/moderacion-general-v3.js","utf8");
if(!mod.includes("syncActivityPreparedV2"))throw new Error("Moderación de Actividades no usa read model preparado.");
if(mod.includes("listCollection("))throw new Error("Moderación normal contiene scan global.");

const gh=fs.readFileSync("reconstruccion/plataforma/granhermano-v2.html","utf8");
for(const token of [
  "/superadmin/session/login",
  "/superadmin/dashboard",
  "/superadmin/moderation/pending",
  "/superadmin/moderation/resolve"
]){
  if(!gh.includes(token))throw new Error("Gran Hermano no usa "+token);
}
for(const legacy of ["api('login'","api('pendientes'","api('resolver_pendiente'"]){
  if(gh.includes(legacy))throw new Error("Gran Hermano conserva acción legacy "+legacy);
}

const admin3=fs.readFileSync("reconstruccion/worker/routes/admin-v3.js","utf8");
if(admin3.includes("rebuildFarmAll({"))throw new Error("Admin V3 conserva llamada rota rebuildFarmAll.");

console.log("AUDITORIA V31 OK");
