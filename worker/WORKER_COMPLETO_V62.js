// reconstruccion/worker/core/db.js
var tokenCache = { token: "", expiresAt: 0, pending: null };
function text(v) {
  return String(v ?? "").trim();
}
function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((x) => binary += String.fromCharCode(x));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function pemBuffer(pem) {
  const clean2 = String(pem || "").replace(/\\n/g, "\n").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
  const bin = atob(clean2);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function newToken(env) {
  const project = text(env.FIREBASE_PROJECT_ID), email = text(env.FIREBASE_CLIENT_EMAIL), privateKey = text(env.FIREBASE_PRIVATE_KEY);
  if (!project || !email || !privateKey) throw new Error("Faltan credenciales Firebase.");
  const now = Math.floor(Date.now() / 1e3);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = head + "." + payload;
  const key3 = await crypto.subtle.importKey("pkcs8", pemBuffer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key3, new TextEncoder().encode(unsigned));
  const jwt = unsigned + "." + b64url(new Uint8Array(sig));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("No se pudo obtener token Google.");
  tokenCache.token = j.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(60, Number(j.expires_in || 3600) - 120) * 1e3;
  return tokenCache.token;
}
async function token(env) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  if (tokenCache.pending) return tokenCache.pending;
  tokenCache.pending = newToken(env);
  try {
    return await tokenCache.pending;
  } finally {
    tokenCache.pending = null;
  }
}
function base(env) {
  const project = text(env.FIREBASE_PROJECT_ID);
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
}
function fromFs(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue && v.arrayValue.values || []).map(fromFs);
  if ("mapValue" in v) return fieldsFromFs(v.mapValue && v.mapValue.fields || {});
  return null;
}
function fieldsFromFs(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) o[k] = fromFs(v);
  return o;
}
function toFs(v) {
  if (v == null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") {
    const fields = {};
    for (const [k, x] of Object.entries(v)) if (x !== void 0) fields[k] = toFs(x);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function docToJs(doc, id4 = "") {
  if (!doc) return null;
  return { id: id4 || String(doc.name || "").split("/").pop(), ...fieldsFromFs(doc.fields || {}) };
}
async function request(env, path, { method = "GET", body = null, allow404 = false } = {}) {
  const r = await fetch(base(env) + "/" + path, { method, headers: { Authorization: "Bearer " + await token(env), ...body !== null ? { "Content-Type": "application/json" } : {} }, ...body !== null ? { body: JSON.stringify(body) } : {} });
  if (allow404 && r.status === 404) return null;
  const raw = await r.text();
  let j = null;
  try {
    j = raw ? JSON.parse(raw) : null;
  } catch (_) {
  }
  if (!r.ok) throw new Error(`Firestore ${method} ${path}: ${r.status} ${raw.slice(0, 250)}`);
  return j;
}
function createDb(env) {
  return {
    async get(collection, id4) {
      const d = await request(env, `${encodeURIComponent(collection)}/${encodeURIComponent(id4)}`, { allow404: true });
      return docToJs(d, id4);
    },
    async patch(collection, id4, patch, { mustExist = false } = {}) {
      const clean2 = {};
      for (const [k, v] of Object.entries(patch || {})) if (v !== void 0) clean2[k] = v;
      const qs = new URLSearchParams();
      Object.keys(clean2).forEach((k) => qs.append("updateMask.fieldPaths", k));
      if (mustExist) qs.set("currentDocument.exists", "true");
      const fields = {};
      for (const [k, v] of Object.entries(clean2)) fields[k] = toFs(v);
      const d = await request(env, `${encodeURIComponent(collection)}/${encodeURIComponent(id4)}?${qs}`, { method: "PATCH", body: { fields } });
      return docToJs(d, id4);
    },
    async delete(collection, id4, { mustExist = false } = {}) {
      const qs = new URLSearchParams();
      if (mustExist) qs.set("currentDocument.exists", "true");
      const suffix = qs.toString() ? "?" + qs.toString() : "";
      await request(env, `${encodeURIComponent(collection)}/${encodeURIComponent(id4)}${suffix}`, { method: "DELETE" });
      return true;
    },
    /**
     * Sólo para mantenimiento explícito / seed de cachés.
     * No usar dentro de acciones interactivas normales.
     */
    async listCollection(collection, pageSize = 1e3) {
      let pageToken = "";
      const out2 = [];
      do {
        const qs = new URLSearchParams({ pageSize: String(pageSize) });
        if (pageToken) qs.set("pageToken", pageToken);
        const j = await request(env, `${encodeURIComponent(collection)}?${qs}`) || {};
        for (const d of j.documents || []) out2.push(docToJs(d));
        pageToken = String(j.nextPageToken || "");
      } while (pageToken);
      return out2;
    },
    async queryEqual(collection, field, value, limit = 1e3) {
      const project = text(env.FIREBASE_PROJECT_ID);
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents:runQuery`;
      const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + await token(env), "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toFs(value) } }, limit: Number(limit) } }) });
      const rows = await r.json().catch(() => []);
      if (!r.ok) throw new Error(`Firestore query ${collection}.${field}: ${r.status}`);
      return (Array.isArray(rows) ? rows : []).filter((x) => x.document).map((x) => docToJs(x.document));
    }
  };
}

// reconstruccion/worker/core/cache.js
function createCache(env) {
  const kv = env.GLD_CACHE_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    throw new Error("Falta binding GLD_CACHE_KV.");
  }
  return {
    async get(key3) {
      const raw = await kv.get(key3);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    },
    async put(key3, value, options) {
      await kv.put(key3, JSON.stringify(value), options);
    },
    async del(key3) {
      if (typeof kv.delete === "function") await kv.delete(key3);
    }
  };
}

// reconstruccion/worker/core/http.js
function cors(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,Authorization",
    "Access-Control-Expose-Headers":"X-GLD-Request-Id,X-GLD-Worker-Version,X-GLD-Read-Calls,X-GLD-Documents-Returned,X-GLD-Write-Calls,X-GLD-Delete-Calls,X-GLD-Source,X-GLD-Public-Blocked"
  };
}
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(), ...extraHeaders } });
}
function publicJson(data, status = 200) {
  return json(data, status, { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" });
}

// reconstruccion/worker/core/auth-admin.js
function text2(v) {
  return String(v ?? "").trim();
}
function b64(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((x) => binary += String.fromCharCode(x));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64decode(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(env, value) {
  const secret = text2(env.SERVER_SECRET);
  if (!secret) throw new Error("Falta SERVER_SECRET");
  const key3 = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key3, new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
async function verifyAdmin(env, request2) {
  const auth = text2(request2.headers.get("Authorization"));
  if (!auth.toLowerCase().startsWith("bearer ")) return { ok: false, message: "Sesión de administrador requerida" };
  const parts = auth.slice(7).trim().split(".");
  if (parts.length !== 2) return { ok: false, message: "Sesión inválida" };
  const [body, sig] = parts;
  if (sig !== await hmac(env, body)) return { ok: false, message: "Sesión inválida" };
  let p = null;
  try {
    p = JSON.parse(b64decode(body));
  } catch (_) {
  }
  if (!p || !p.sid || !p.exp || Date.now() > Number(p.exp)) return { ok: false, message: "Sesión inválida o vencida" };
  const rol = text2(p.rol).toUpperCase();
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(rol)) return { ok: false, message: "Rol administrativo no habilitado" };
  return { ok: true, sid: text2(p.sid), rol };
}

// reconstruccion/worker/modules/territory.js
var PUBLIC_KEY = "territorio:public:v1";
var ADMIN_KEY = "territorio:admin:v1";
var C = { paises: "paises", provincias: "provincias", ciudades: "ciudades" };
var text3 = (v) => String(v ?? "").trim();
function bool(v) {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "activo", "activa"].includes(text3(v).toLowerCase());
}
function active(row) {
  if (row.activa === void 0 && row.activo === void 0) return true;
  return bool(row.activa ?? row.activo);
}
function packet(v) {
  const x = v && typeof v === "object" ? v : {};
  return { version: 1, updated_at: text3(x.updated_at), paises: Array.isArray(x.paises) ? x.paises : [], provincias: Array.isArray(x.provincias) ? x.provincias : [], ciudades: Array.isArray(x.ciudades) ? x.ciudades : [] };
}
function upsert(rows, idField, item) {
  const id4 = text3(item[idField] || item.id);
  const out2 = [...rows || []];
  const i = out2.findIndex((x) => text3(x[idField] || x.id) === id4);
  if (i >= 0) out2[i] = item;
  else out2.push(item);
  return out2;
}
function remove(rows, idField, id4) {
  return (rows || []).filter((x) => text3(x[idField] || x.id) !== text3(id4));
}
function sortCities(rows) {
  return [...rows || []].sort((a, b) => text3(a.ciudad_visible || a.nombre || a.ciudad).localeCompare(text3(b.ciudad_visible || b.nombre || b.ciudad), "es", { sensitivity: "base" }));
}
function publicCity(row, admin) {
  const prov = (admin.provincias || []).find((x) => text3(x.provincia_id || x.id) === text3(row.provincia_id)) || {};
  const pais = (admin.paises || []).find((x) => text3(x.pais_id || x.id) === text3(row.pais_id || prov.pais_id)) || {};
  return {
    ciudad_id: text3(row.ciudad_id || row.id),
    ciudad_visible: text3(row.ciudad_visible || row.nombre || row.ciudad),
    provincia_id: text3(row.provincia_id),
    provincia_visible: text3(row.provincia_visible || row.provincia || prov.provincia_visible || prov.nombre || prov.provincia),
    pais_id: text3(row.pais_id || prov.pais_id),
    pais_visible: text3(row.pais_visible || row.pais || pais.pais_visible || pais.nombre || pais.pais),
    pais_codigo: text3(row.pais_codigo || row.codigo_pais || pais.pais_codigo || pais.codigo_pais || pais.codigo),
    activa: active(row)
  };
}
async function authOr401(env, request2) {
  const a = await verifyAdmin(env, request2);
  return a.ok ? a : json({ success: false, message: a.message }, 401);
}
async function territoryPublic({ cache }) {
  const p = await cache.get(PUBLIC_KEY);
  if (!p) return json({ success: false, message: "Catálogo territorial no inicializado" }, 503);
  return publicJson({ success: true, ...packet(p) });
}
async function territoryAdmin({ env, request: request2, cache }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  const p = await cache.get(ADMIN_KEY);
  if (!p) return json({ success: false, message: "Catálogo territorial no inicializado" }, 503);
  return json({ success: true, ...packet(p) });
}
async function saveCountry({ env, request: request2, db, cache, idFromPath = "" }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  let body = {};
  try {
    body = await request2.json();
  } catch (_) {
  }
  const item = body.item && typeof body.item === "object" ? body.item : body;
  const id4 = text3(idFromPath || item.pais_id || item.id), nombre = text3(item.pais_visible || item.nombre || item.pais);
  if (!id4 || !nombre) return json({ success: false, message: "Faltan pais_id o nombre" }, 400);
  const saved = await db.patch(C.paises, id4, { ...item, pais_id: id4, nombre, pais_visible: nombre, activo: item.activo !== void 0 ? bool(item.activo) : true, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() });
  const admin = packet(await cache.get(ADMIN_KEY)), pub = packet(await cache.get(PUBLIC_KEY)), now = (/* @__PURE__ */ new Date()).toISOString();
  const nextAdmin = { ...admin, updated_at: now, paises: upsert(admin.paises, "pais_id", saved) };
  let paises = remove(pub.paises, "pais_id", id4);
  if (active(saved)) paises = upsert(paises, "pais_id", saved);
  await Promise.all([cache.put(ADMIN_KEY, nextAdmin), cache.put(PUBLIC_KEY, { ...pub, updated_at: now, paises })]);
  return json({ success: true, pais: saved });
}
async function saveProvince({ env, request: request2, db, cache, idFromPath = "" }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  let body = {};
  try {
    body = await request2.json();
  } catch (_) {
  }
  const item = body.item && typeof body.item === "object" ? body.item : body;
  const id4 = text3(idFromPath || item.provincia_id || item.id), nombre = text3(item.provincia_visible || item.nombre || item.provincia), pais_id = text3(item.pais_id);
  const admin = packet(await cache.get(ADMIN_KEY));
  if (!id4 || !nombre || !pais_id) return json({ success: false, message: "Faltan provincia_id, nombre o pais_id" }, 400);
  if (!admin.paises.some((x) => text3(x.pais_id || x.id) === pais_id)) return json({ success: false, message: "pais_id inexistente" }, 400);
  const saved = await db.patch(C.provincias, id4, { ...item, provincia_id: id4, nombre, provincia_visible: nombre, pais_id, activo: item.activo !== void 0 ? bool(item.activo) : true, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() });
  const pub = packet(await cache.get(PUBLIC_KEY)), now = (/* @__PURE__ */ new Date()).toISOString();
  const nextAdmin = { ...admin, updated_at: now, provincias: upsert(admin.provincias, "provincia_id", saved) };
  let provincias = remove(pub.provincias, "provincia_id", id4);
  if (active(saved)) provincias = upsert(provincias, "provincia_id", saved);
  await Promise.all([cache.put(ADMIN_KEY, nextAdmin), cache.put(PUBLIC_KEY, { ...pub, updated_at: now, provincias })]);
  return json({ success: true, provincia: saved });
}
async function saveCity({ env, request: request2, db, cache, idFromPath = "" }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  let body = {};
  try {
    body = await request2.json();
  } catch (_) {
  }
  const item = body.item && typeof body.item === "object" ? body.item : body;
  const admin = packet(await cache.get(ADMIN_KEY));
  const id4 = text3(idFromPath || item.ciudad_id || item.id), nombre = text3(item.ciudad_visible || item.nombre || item.ciudad), pais_id = text3(item.pais_id), provincia_id = text3(item.provincia_id);
  if (!id4 || !nombre || !pais_id || !provincia_id) return json({ success: false, message: "Faltan datos obligatorios de ciudad" }, 400);
  const prov = admin.provincias.find((x) => text3(x.provincia_id || x.id) === provincia_id);
  if (!prov || text3(prov.pais_id) !== pais_id) return json({ success: false, message: "Provincia/país inválidos" }, 400);
  const saved = await db.patch(C.ciudades, id4, { ...item, ciudad_id: id4, ciudad_visible: nombre, pais_id, provincia_id, activa: item.activa !== void 0 ? bool(item.activa) : true, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() });
  const pub = packet(await cache.get(PUBLIC_KEY)), now = (/* @__PURE__ */ new Date()).toISOString();
  const nextAdmin = { ...admin, updated_at: now, ciudades: sortCities(upsert(admin.ciudades, "ciudad_id", saved)) };
  let ciudades = remove(pub.ciudades, "ciudad_id", id4);
  if (active(saved)) ciudades = upsert(ciudades, "ciudad_id", publicCity(saved, nextAdmin));
  await Promise.all([cache.put(ADMIN_KEY, nextAdmin), cache.put(PUBLIC_KEY, { ...pub, updated_at: now, ciudades: sortCities(ciudades) })]);
  return json({ success: true, ciudad: saved });
}
async function rebuildTerritory({ env, request: request2, db, cache }) {
  const a = await authOr401(env, request2);
  if (a instanceof Response) return a;
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(a.rol)) return json({ success: false, message: "Permiso insuficiente" }, 403);
  const [paises, provincias, ciudades] = await Promise.all([db.listCollection(C.paises), db.listCollection(C.provincias), db.listCollection(C.ciudades)]);
  const now = (/* @__PURE__ */ new Date()).toISOString(), admin = { version: 1, updated_at: now, paises, provincias, ciudades: sortCities(ciudades) };
  const pub = { version: 1, updated_at: now, paises: paises.filter(active), provincias: provincias.filter(active), ciudades: sortCities(ciudades.filter(active).map((x) => publicCity(x, admin))) };
  await Promise.all([cache.put(ADMIN_KEY, admin), cache.put(PUBLIC_KEY, pub)]);
  return json({ success: true, rebuilt: true, counts: { paises: paises.length, provincias: provincias.length, ciudades: ciudades.length } });
}

// reconstruccion/worker/core/guide-read-model.js
var text4 = (v) => String(v ?? "").trim();
var bool2 = (v) => {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "aprobado", "activo", "activa"].includes(text4(v).toLowerCase());
};
var ids = (v) => Array.isArray(v) ? v.map(text4).filter(Boolean) : text4(v).split(/[;,|\n]/).map(text4).filter(Boolean);
var guideCityKey = (cityId) => "guide:city:v1:" + text4(cityId);
function mapBy(rows, field) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const id4 = text4(r && r[field] || r && r.id);
    if (id4) m.set(id4, r);
  }
  return m;
}
function relObjects(values, map, idField) {
  return ids(values).map((id4) => {
    const x = map.get(id4) || {};
    return { [idField]: id4, nombre: text4(x.nombre), insignia: text4(x.insignia) };
  });
}
function buildGuideCard({ advertiser, admin, sedes, catalogs, territory, cityId }) {
  if (!advertiser) return null;
  if (admin && admin.aprobado !== void 0 && !bool2(admin.aprobado)) return null;
  const city = text4(cityId);
  const citySedes = (sedes || []).filter((s) => text4(s.ciudad_id) === city);
  if (!citySedes.length) return null;
  const segMap = mapBy(catalogs.segmentos, "segmento_id");
  const catMap = mapBy(catalogs.categorias, "categoria_id");
  const actMap = mapBy(catalogs.actividades_clave, "actividad_id");
  const actionMap = mapBy(catalogs.acciones, "accion_id");
  const nodeMap = mapBy(catalogs.nodos, "nodo_id");
  const segmentoId = text4(advertiser.segmento_id);
  const segmento = segMap.get(segmentoId) || {};
  const categoriaIds = ids(advertiser.categoria_ids || advertiser.categoria_id);
  const categorias = categoriaIds.map((id4) => catMap.get(id4)).filter(Boolean).map((x) => text4(x.nombre)).filter(Boolean);
  const cityMeta = (territory.ciudades || []).find((x) => text4(x.ciudad_id || x.id) === city) || {};
  const sedesPublicas = citySedes.map((s) => ({
    sede_id: text4(s.sede_id || s.id),
    nombre_sede: text4(s.nombre_sede),
    direccion: text4(s.direccion),
    ciudad_id: city,
    ciudad: text4(s.ciudad || cityMeta.ciudad_visible),
    provincia_id: text4(s.provincia_id || cityMeta.provincia_id),
    provincia: text4(s.provincia || cityMeta.provincia_visible),
    pais_id: text4(s.pais_id || cityMeta.pais_id),
    pais: text4(s.pais || cityMeta.pais_visible),
    codigo_postal: text4(s.codigo_postal),
    lat: s.lat ?? "",
    lng: s.lng ?? "",
    maps: text4(s.maps),
    telefono: text4(s.telefono),
    telefono2: text4(s.telefono2),
    telefono3: text4(s.telefono3),
    telefono4: text4(s.telefono4),
    telefono5: text4(s.telefono5),
    whatsapp: text4(s.whatsapp),
    whatsapp2: text4(s.whatsapp2),
    whatsapp3: text4(s.whatsapp3),
    whatsapp4: text4(s.whatsapp4),
    whatsapp5: text4(s.whatsapp5),
    mail: text4(s.mail),
    mail2: text4(s.mail2),
    mail3: text4(s.mail3),
    instagram: text4(s.instagram),
    facebook: text4(s.facebook),
    youtube: text4(s.youtube),
    tiktok: text4(s.tiktok),
    x: text4(s.x),
    linkedin: text4(s.linkedin),
    estado: text4(s.estado),
    actividades: relObjects(s.actividad_ids, actMap, "actividad_id"),
    acciones: relObjects(s.accion_ids, actionMap, "accion_id"),
    nodos: relObjects(s.nodo_ids, nodeMap, "nodo_id"),
    img1: text4(s.img1),
    img2: text4(s.img2),
    img3: text4(s.img3),
    img4: text4(s.img4),
    img5: text4(s.img5),
    img6: text4(s.img6),
    img7: text4(s.img7),
    img8: text4(s.img8),
    img9: text4(s.img9),
    img10: text4(s.img10)
  }));
  return {
    id: text4(advertiser.id || advertiser.anunciante_id),
    nombre: text4(advertiser.nombre),
    nivel: text4(admin && admin.nivel),
    subnivel: text4(admin && admin.subnivel),
    verificado: bool2(admin && admin.verificado),
    gold: bool2(admin && admin.gold),
    segmento_id: segmentoId,
    segmento: text4(segmento.nombre),
    categoria_ids: categoriaIds,
    categorias,
    actividad: text4(advertiser.actividad),
    descripcion: text4(advertiser.descripcion),
    tags: text4(advertiser.tags),
    adicionales: text4(advertiser.adicionales),
    logo: text4(advertiser.logo),
    img1: text4(advertiser.img1),
    img2: text4(advertiser.img2),
    img3: text4(advertiser.img3),
    img4: text4(advertiser.img4),
    img5: text4(advertiser.img5),
    img6: text4(advertiser.img6),
    img7: text4(advertiser.img7),
    img8: text4(advertiser.img8),
    img9: text4(advertiser.img9),
    img10: text4(advertiser.img10),
    link: text4(advertiser.link),
    ciudad_id: city,
    ciudad: text4(cityMeta.ciudad_visible),
    provincia_id: text4(cityMeta.provincia_id),
    provincia: text4(cityMeta.provincia_visible),
    pais_id: text4(cityMeta.pais_id),
    pais: text4(cityMeta.pais_visible),
    sedes: sedesPublicas
  };
}
function sortCards(rows) {
  return [...rows].sort((a, b) => text4(a.nombre).localeCompare(text4(b.nombre), "es", { sensitivity: "base" }));
}
async function syncGuideAdvertiser({ db, cache, advertiserId, affectedCityIds = [] }) {
  const aid = text4(advertiserId);
  const [advertiser, admin, sedes, catalogs, territory] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const currentCities = [...new Set((sedes || []).map((s) => text4(s.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(affectedCityIds || []).map(text4), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = guideCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    const rows = (packet2.anunciantes || []).filter((x) => text4(x.id) !== aid);
    const card = buildGuideCard({
      advertiser,
      admin,
      sedes,
      catalogs: catalogs || {},
      territory: territory || {},
      cityId
    });
    if (card) rows.push(card);
    await cache.put(key3, {
      version: 1,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      anunciantes: sortCards(rows)
    });
  }
  return { success: true, advertiser_id: aid, ciudades_actualizadas: targets };
}
async function getGuideCity({ cache, cityId }) {
  const city = text4(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(guideCityKey(city));
  if (!packet2) return { success: true, ciudad_id: city, anunciantes: [], cold: true };
  return { success: true, ...packet2 };
}
async function rebuildGuideAll({ db, cache }) {
  const [advertisers, admins, sedes, catalogs, territory] = await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const adminMap = mapBy(admins, "id");
  const sedesByAdv = /* @__PURE__ */ new Map();
  for (const s of sedes) {
    const aid = text4(s.anunciante_id);
    if (!sedesByAdv.has(aid)) sedesByAdv.set(aid, []);
    sedesByAdv.get(aid).push(s);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const adv of advertisers) {
    const aid = text4(adv.id || adv.anunciante_id);
    const advSedes = sedesByAdv.get(aid) || [];
    const cityIds = [...new Set(advSedes.map((s) => text4(s.ciudad_id)).filter(Boolean))];
    for (const cityId of cityIds) {
      const card = buildGuideCard({
        advertiser: adv,
        admin: adminMap.get(aid) || {},
        sedes: advSedes,
        catalogs: catalogs || {},
        territory: territory || {},
        cityId
      });
      if (!card) continue;
      if (!byCity.has(cityId)) byCity.set(cityId, []);
      byCity.get(cityId).push(card);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(
    ([cityId, cards]) => cache.put(guideCityKey(cityId), {
      version: 1,
      ciudad_id: cityId,
      updated_at: now,
      anunciantes: sortCards(cards)
    })
  ));
  return { success: true, ciudades: byCity.size, anunciantes: advertisers.length, updated_at: now };
}

// reconstruccion/worker/modules/guide.js
async function guidePublic({ url, cache }) {
  const cityId = String(url.searchParams.get("ciudad_id") || url.searchParams.get("ciudadId") || "").trim();
  const out2 = await getGuideCity({ cache, cityId });
  if (out2.status) return json(out2, out2.status);
  const rows = Array.isArray(out2.anunciantes) ? out2.anunciantes : [];
  return publicJson({ ...out2, results: rows, data: rows });
}

// reconstruccion/worker/core/promos-read-model.js
var text5 = (v) => String(v ?? "").trim();
var bool3 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text5(v).toLowerCase());
var promoCityKey = (cityId) => "promos:city:v1:" + text5(cityId);
function isPaused(p) {
  return bool3(p && p.pausado);
}
function visible(p) {
  if (isPaused(p)) return false;
  const estado = text5(p && p.estado).toUpperCase();
  return !estado || !["INACTIVA", "INACTIVO", "BORRADOR", "RECHAZADA", "RECHAZADO"].includes(estado);
}
function publicPromo(p) {
  return {
    promo_id: text5(p.promo_id || p.id),
    anunciante_id: text5(p.anunciante_id || p.id_comercio),
    promo: text5(p.promo),
    categoria: text5(p.categoria),
    categoria_id: text5(p.categoria_id),
    logo_categoria: text5(p.logo_categoria),
    sede_id: text5(p.sede_id),
    ciudad_id: text5(p.ciudad_id),
    img: text5(p.img),
    desde: text5(p.desde),
    hasta: text5(p.hasta),
    otros: text5(p.otros),
    direccion: text5(p.direccion),
    maps: text5(p.maps),
    telefono: text5(p.telefono),
    whatsapp: text5(p.whatsapp),
    instagram: text5(p.instagram),
    facebook: text5(p.facebook),
    youtube: text5(p.youtube),
    tiktok: text5(p.tiktok),
    linkedin: text5(p.linkedin),
    x: text5(p.x)
  };
}
function sort(rows) {
  return [...rows].sort((a, b) => text5(a.promo).localeCompare(text5(b.promo), "es", { sensitivity: "base" }));
}
async function syncPromo({ cache, current = null, next = null }) {
  const id4 = text5(next && next.promo_id || current && current.promo_id || next && next.id || current && current.id);
  const cities = [...new Set([text5(current && current.ciudad_id), text5(next && next.ciudad_id)].filter(Boolean))];
  for (const cityId of cities) {
    const key3 = promoCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", promos: [] };
    let rows = (packet2.promos || []).filter((x) => text5(x.promo_id) !== id4);
    if (next && text5(next.ciudad_id) === cityId && visible(next)) rows.push(publicPromo(next));
    await cache.put(key3, { version: 1, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), promos: sort(rows) });
  }
  return { success: true, ciudades_actualizadas: cities };
}
async function getPromosCity({ cache, cityId }) {
  const city = text5(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(promoCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, promos: [], cold: true };
}
async function rebuildPromosAll({ db, cache }) {
  const all = await db.listCollection("promos");
  const byCity = /* @__PURE__ */ new Map();
  for (const p of all) {
    if (!visible(p)) continue;
    const city = text5(p.ciudad_id);
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(publicPromo(p));
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, promos]) => cache.put(promoCityKey(city), { version: 1, ciudad_id: city, updated_at: now, promos: sort(promos) })));
  return { success: true, ciudades: byCity.size, promos: all.length, updated_at: now };
}

// reconstruccion/worker/core/prepared-relations-v1.js
var text6 = (v) => String(v ?? "").trim();
var key = (type, id4) => "relations:prepared:v1:" + type + ":" + text6(id4);
var revision = (row) => text6(row?.actualizado || row?.actualizado_en || row?.creado);
async function getPreparedRelationsV1({ cache, type, id: id4, current, load }) {
  const packet2 = await cache.get(key(type, id4));
  if (packet2 && packet2.revision === revision(current) && packet2.data) return packet2.data;
  return load();
}
async function putPreparedRelationsV1({ cache, type, id: id4, next, data }) {
  await cache.put(key(type, id4), { revision: revision(next), data: next ? data : null });
}

// reconstruccion/worker/core/events-read-model-v2.js
var text7 = (v) => String(v ?? "").trim();
var bool4 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text7(v).toLowerCase());
var eventsCityKey = (cityId) => "events:city:v2:" + text7(cityId);
function published(e) {
  if (bool4(e && e.pausado)) return false;
  const estado = text7(e && e.estado).toUpperCase();
  const mod = text7(e && e.estado_moderacion).toUpperCase();
  if (["RECHAZADA", "RECHAZADO", "BORRADOR", "INACTIVA", "INACTIVO"].includes(estado)) return false;
  return ["APROBADO", "APROBADA", "PUBLICADO", "PUBLICADA"].includes(mod);
}
function cleanEvent(e, programacion = []) {
  const out2 = { ...e, programacion: [...programacion].sort(
    (a, b) => Number(a.orden || 0) - Number(b.orden || 0) || text7(a.fecha).localeCompare(text7(b.fecha)) || text7(a.hora_desde).localeCompare(text7(b.hora_desde))
  ) };
  delete out2.__id;
  delete out2.moderado_por;
  delete out2.motivo_revision;
  return out2;
}
function sort2(rows) {
  return [...rows].sort((a, b) => {
    const da = text7(a.fecha_desde || a.fecha || a.desde), db = text7(b.fecha_desde || b.fecha || b.desde);
    return da.localeCompare(db) || text7(a.nombre_evento || a.nombre).localeCompare(text7(b.nombre_evento || b.nombre), "es", { sensitivity: "base" });
  });
}
var coverageKey = (id4) => "events:coverage:v1:" + text7(id4);
function eventCities(event, programacion = []) {
  if (!event) return [];
  if (programacion.length) return [...new Set(programacion.filter((p) => p.activo !== false).map((p) => text7(p.ciudad_id || event.ciudad_id)).filter(Boolean))];
  return [text7(event.ciudad_id)].filter(Boolean);
}
function cityEvent(event, programacion, city) {
  const local = programacion.filter((p) => p.activo !== false && text7(p.ciudad_id || event.ciudad_id) === city);
  const dates = local.map((p) => text7(p.fecha)).filter(Boolean).sort();
  return cleanEvent({
    ...event,
    ciudad_origen_id: text7(event.ciudad_id),
    ciudad_id: city,
    ...dates.length ? { fecha_desde: dates[0], fecha_hasta: dates.at(-1) } : {}
  }, local);
}
async function syncEventV2({ db, cache, current = null, next = null, previousProgramacion = [], programacion: provided = void 0 }) {
  const id4 = text7(next?.evento_id || current?.evento_id || next?.id || current?.id);
  const previous = await cache.get(coverageKey(id4));
  const programacion = provided ?? (next ? await getPreparedRelationsV1({
    cache,
    type: "event",
    id: id4,
    current: current || next,
    load: () => db.queryEqual("evento_programacion", "evento_id", id4, 500)
  }) : []);
  const nextCities = eventCities(next, programacion);
  const cities = [.../* @__PURE__ */ new Set([...previous?.ciudades || [], ...eventCities(current, previousProgramacion), ...nextCities])];
  for (const cityId of cities) {
    const key3 = eventsCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", events: [] };
    const rows = (packet2.events || []).filter((x) => text7(x.evento_id || x.id) !== id4);
    if (next && nextCities.includes(cityId) && published(next)) rows.push(cityEvent(next, programacion, cityId));
    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), events: sort2(rows) });
  }
  await cache.put(coverageKey(id4), { ciudades: nextCities });
  await putPreparedRelationsV1({ cache, type: "event", id: id4, next, data: programacion });
  return { success: true, ciudades_actualizadas: cities };
}
async function getEventsCityV2({ cache, cityId }) {
  const city = text7(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(eventsCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, events: [], cold: true };
}
async function rebuildEventsAllV2({ db, cache }) {
  const [events, programas] = await Promise.all([
    db.listCollection("eventos"),
    db.listCollection("evento_programacion")
  ]);
  const byEvent = /* @__PURE__ */ new Map();
  for (const p of programas) {
    const id4 = text7(p.evento_id);
    if (!id4) continue;
    if (!byEvent.has(id4)) byEvent.set(id4, []);
    byEvent.get(id4).push(p);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const e of events) {
    const id4 = text7(e.evento_id || e.id), programacion = byEvent.get(id4) || [];
    const cities = eventCities(e, programacion);
    const previous = await cache.get(coverageKey(id4));
    for (const city of previous?.ciudades || []) if (!byCity.has(city)) byCity.set(city, []);
    await cache.put(coverageKey(id4), { ciudades: cities });
    await putPreparedRelationsV1({ cache, type: "event", id: id4, next: e, data: programacion });
    if (!published(e)) continue;
    for (const city of cities) {
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push(cityEvent(e, programacion, city));
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, rows]) => cache.put(eventsCityKey(city), {
    version: 2,
    ciudad_id: city,
    updated_at: now,
    events: sort2(rows)
  })));
  return { success: true, ciudades: byCity.size, eventos: events.length, updated_at: now };
}

// reconstruccion/worker/core/activities-read-model.js
var text8 = (v) => String(v ?? "").trim();
var bool5 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text8(v).toLowerCase());
var activityCityKey = (cityId) => "activities:city:v1:" + text8(cityId);
function isPublic(a) {
  if (!a || !bool5(a.activo) || !bool5(a.aprobado)) return false;
  const estado = text8(a.estado).toUpperCase();
  if (["PAUSADA", "PAUSADO", "INACTIVA", "INACTIVO", "BORRADOR", "ELIMINADA", "ELIMINADO"].includes(estado)) return false;
  const now = /* @__PURE__ */ new Date();
  const hoy = new Date(now.getTime() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  if (text8(a.vigente_desde) && text8(a.vigente_desde) > hoy) return false;
  if (text8(a.vigente_hasta) && text8(a.vigente_hasta) < hoy) return false;
  return true;
}
function sort3(rows) {
  return [...rows].sort((a, b) => text8(a.nombre).localeCompare(text8(b.nombre), "es", { sensitivity: "base" }));
}
async function syncActivity({ db, cache, activityId, previousCities = [] }) {
  const id4 = text8(activityId);
  const activity = await db.get("actividades", id4);
  const horarios = activity ? await db.queryEqual("actividad_horarios", "actividad_id", id4) : [];
  const currentCities = [...new Set(horarios.map((h) => text8(h.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text8), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = activityCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", actividades: [] };
    let rows = (packet2.actividades || []).filter((x) => text8(x.actividad_id || x.id) !== id4);
    if (activity && isPublic(activity)) {
      const hs = horarios.filter((h) => text8(h.ciudad_id) === cityId && (h.activo === void 0 || bool5(h.activo)));
      if (hs.length) rows.push({ ...activity, horarios: hs });
    }
    await cache.put(key3, { version: 1, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), actividades: sort3(rows) });
  }
  return { success: true, ciudades_actualizadas: targets };
}
async function getActivitiesCity({ cache, cityId }) {
  const city = text8(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(activityCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, actividades: [], cold: true };
}

// reconstruccion/worker/core/publicity-read-model.js
var text9 = (v) => String(v ?? "").trim();
var publicityCityKey = (cityId) => "publicity:city:v1:" + text9(cityId);
function isActive(p) {
  return text9(p && p.estado).toUpperCase() === "ACTIVA";
}
function sort4(rows) {
  return [...rows].sort((a, b) => text9(a.titulo || a.nombre_interno).localeCompare(text9(b.titulo || b.nombre_interno), "es", { sensitivity: "base" }));
}
async function syncPublicity({ db, cache, publicityId, previousCities = [] }) {
  const id4 = text9(publicityId);
  const doc = await db.get("publicidades", id4);
  const seg = doc ? await db.queryEqual("publicidad_segmentacion", "publicidad_id", id4) : [];
  const currentCities = [...new Set(seg.map((x) => text9(x.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text9), ...currentCities].filter(Boolean))];
  let media = [];
  if (doc) media = await db.queryEqual("publicidad_media", "publicidad_id", id4);
  for (const cityId of targets) {
    const key3 = publicityCityKey(cityId);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: cityId, updated_at: "", publicidades: [] };
    let rows = (packet2.publicidades || []).filter((x) => text9(x.publicidad_id || x.id) !== id4);
    if (doc && isActive(doc) && currentCities.includes(cityId)) {
      rows.push({ ...doc, media, segmentacion: seg.filter((x) => text9(x.ciudad_id) === cityId) });
    }
    await cache.put(key3, { version: 1, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), publicidades: sort4(rows) });
  }
  return { success: true, ciudades_actualizadas: targets };
}
async function getPublicityCity({ cache, cityId }) {
  const city = text9(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(publicityCityKey(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, publicidades: [], cold: true };
}

// reconstruccion/worker/core/efemerides-read-model.js
var text10 = (v) => String(v ?? "").trim();
var bool6 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text10(v).toLowerCase());
var efemCityKey = (cityId) => "efemerides:city:v1:" + text10(cityId);
function matchesCity(e, city, territory) {
  const tipo = text10(e.tipo).toUpperCase();
  if (tipo === "GENERAL") return true;
  if (tipo === "LOCAL") return text10(e.ciudad_id) === city;
  if (tipo === "PROVINCIAL") {
    const c = (territory.ciudades || []).find((x) => text10(x.ciudad_id || x.id) === city) || {};
    return text10(e.provincia_id) === text10(c.provincia_id);
  }
  return false;
}
async function syncEfemeride({ db, cache, efemerideId, previous = null }) {
  const id4 = text10(efemerideId), next = await db.get("efemerides_bis", id4), territory = await cache.get("territorio:public:v1") || {};
  const targets = /* @__PURE__ */ new Set();
  for (const e of [previous, next].filter(Boolean)) {
    const tipo = text10(e.tipo).toUpperCase();
    if (tipo === "LOCAL" && text10(e.ciudad_id)) targets.add(text10(e.ciudad_id));
    if (tipo === "PROVINCIAL") {
      for (const c of territory.ciudades || []) if (text10(c.provincia_id) === text10(e.provincia_id)) targets.add(text10(c.ciudad_id || c.id));
    }
    if (tipo === "GENERAL") for (const c of territory.ciudades || []) targets.add(text10(c.ciudad_id || c.id));
  }
  for (const city of [...targets].filter(Boolean)) {
    const key3 = efemCityKey(city), packet2 = await cache.get(key3) || { version: 1, ciudad_id: city, updated_at: "", efemerides: [] };
    let rows = (packet2.efemerides || []).filter((x) => text10(x.efemeride_id || x.id) !== id4);
    if (next && (next.activo === void 0 || bool6(next.activo)) && matchesCity(next, city, territory)) rows.push(next);
    await cache.put(key3, { version: 1, ciudad_id: city, updated_at: (/* @__PURE__ */ new Date()).toISOString(), efemerides: rows });
  }
  return { success: true, ciudades_actualizadas: [...targets] };
}
async function getEfemCity({ cache, cityId }) {
  const city = text10(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const p = await cache.get(efemCityKey(city));
  return p ? { success: true, ...p } : { success: true, ciudad_id: city, efemerides: [], cold: true };
}

// reconstruccion/worker/modules/efemerides-public-v2.js
var text11 = (v) => String(v ?? "").trim();
function dayNumber(raw) {
  const s = text11(raw).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };
  if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : -1;
}
function dateFrom(raw) {
  const s = text11(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return /* @__PURE__ */ new Date();
}
function matches(row, date) {
  const type = text11(row.tipo_fecha).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (type === "FIJA") {
    return Number(row.mes || 0) === date.getMonth() + 1 && Number(row.dia || 0) === date.getDate();
  }
  if (type === "MOVIL") {
    if (Number(row.mes || 0) !== date.getMonth() + 1) return false;
    if (dayNumber(row.dia_semana) !== date.getDay()) return false;
    const raw = text11(row.semana_mes).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw === "ULTIMA") {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next.getMonth() !== date.getMonth();
    }
    const week = Number(raw || 0);
    return Number.isInteger(week) && week >= 1 && week <= 5 && Math.floor((date.getDate() - 1) / 7) + 1 === week;
  }
  return false;
}
async function efemeridesPublicV2({ cache, cityId, fecha = "" }) {
  const base2 = await getEfemCity({ cache, cityId });
  if (base2.status) return base2;
  const date = dateFrom(fecha);
  const key3 = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  return {
    success: true,
    ciudad_id: text11(cityId),
    fecha: key3,
    efemerides: (base2.efemerides || []).filter((x) => matches(x, date))
  };
}

// reconstruccion/worker/core/farmacias-read-model.js
var text12 = (v) => String(v ?? "").trim();
var farmCityKey = (cityId) => "farmacias:city:v1:" + text12(cityId);
function sortTurnos(rows) {
  return [...rows].sort((a, b) => {
    const ad = text12(a.fecha_inicio) + " " + text12(a.hora_inicio);
    const bd = text12(b.fecha_inicio) + " " + text12(b.hora_inicio);
    return ad.localeCompare(bd);
  });
}
async function syncFarmCycle({ db, cache, cycleId, previousCity = "" }) {
  const id4 = text12(cycleId);
  const cycle = await db.get("farmacias_ciclos", id4);
  const nextCity = text12(cycle && cycle.ciudad_id);
  const targets = [...new Set([text12(previousCity), nextCity].filter(Boolean))];
  for (const city of targets) {
    const key3 = farmCityKey(city);
    const packet2 = await cache.get(key3) || { version: 1, ciudad_id: city, updated_at: "", ciclos: [] };
    let rows = (packet2.ciclos || []).filter((x) => text12(x.ciclo_id || x.id) !== id4);
    if (cycle && nextCity === city) {
      const participantes = await db.queryEqual("farmacias_ciclo_sedes", "ciclo_id", id4);
      const sedeIds = [...new Set(participantes.map((x) => text12(x.sede_id)).filter(Boolean))];
      const sedes = [];
      for (const sid of sedeIds) {
        const s = await db.get("anunciantes_sedes", sid);
        if (s) sedes.push(s);
      }
      rows.push({ ...cycle, participantes, sedes });
    }
    await cache.put(key3, { version: 1, ciudad_id: city, updated_at: (/* @__PURE__ */ new Date()).toISOString(), ciclos: sortTurnos(rows) });
  }
  return { success: true, ciudades_actualizadas: targets };
}
async function getFarmCity({ cache, cityId }) {
  const city = text12(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const p = await cache.get(farmCityKey(city));
  return p ? { success: true, ...p } : { success: true, ciudad_id: city, ciclos: [], cold: true };
}

// reconstruccion/worker/routes/public-v4.js
var text13 = (v) => String(v ?? "").trim();
var out = (r) => r.status ? json(r, r.status) : publicJson(r);
async function routePublicV4({ path, request: request2, url, cache }) {
  if (path === "/territory/public" && request2.method === "GET") return territoryPublic({ cache });
  if (path === "/guide" && request2.method === "GET") return guidePublic({ url, cache });
  const city = text13(url.searchParams.get("ciudad_id"));
  if (path === "/promos" && request2.method === "GET") {
    return out(await getPromosCity({ cache, cityId: city }));
  }
  if (path === "/events-new" && request2.method === "GET") {
    const r = await getEventsCityV2({ cache, cityId: city });
    if (r.status) return json(r, r.status);
    return publicJson({ success: true, events: r.events || [], data: r.events || [], ...r });
  }
  if (path === "/actividades" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") return out(await getActivitiesCity({ cache, cityId: city }));
  }
  if (path === "/publicidad" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") return out(await getPublicityCity({ cache, cityId: city }));
  }
  if (path === "/efemerides" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (["efemerides", "publicas", "public"].includes(action)) {
      return out(await efemeridesPublicV2({
        cache,
        cityId: city,
        fecha: text13(url.searchParams.get("fecha"))
      }));
    }
  }
  if (path === "/farmacias" && request2.method === "GET") {
    const action = text13(url.searchParams.get("action")).toLowerCase();
    if (action === "turnos") return out(await getFarmCity({ cache, cityId: city }));
  }
  return null;
}

// reconstruccion/worker/core/catalogs.js
var KEYS = {
  commerce: "catalogs:commerce:v1",
  promos: "catalogs:promos:v1",
  eventos: "catalogs:eventos:v1",
  actividades: "catalogs:actividades:v1",
  publicidad: "catalogs:publicidad:v1",
  admin: "admin:catalogs:v2"
};
function active2(x) {
  if (x.activo === void 0 && x.activa === void 0) return true;
  const v = x.activo ?? x.activa;
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "activo", "activa"].includes(String(v || "").trim().toLowerCase());
}
var onlyActive = (rows) => (rows || []).filter(active2);
async function getCommerceCatalogs(cache) {
  return await cache.get(KEYS.commerce) || { segmentos: [], categorias: [], actividades_clave: [], acciones: [], nodos: [], funcionalidades: [], niveles_anunciante: [] };
}
async function getEventosCatalogs(cache) {
  return await cache.get(KEYS.eventos) || { categorias: [], lugares: [], partners: [] };
}
async function getActividadesCatalogs(cache) {
  return await cache.get(KEYS.actividades) || { categorias: [], lugares: [] };
}
async function getPublicidadCatalogs(cache) {
  return await cache.get(KEYS.publicidad) || { categorias: [], ubicaciones: [], prioridades: [] };
}
async function rebuildCatalogs({ db, cache }) {
  const [
    segmentos,
    categorias,
    actividades,
    acciones,
    nodos,
    funcionalidades,
    niveles,
    promosCategorias,
    eventosCategorias,
    lugares,
    actividadesCategorias,
    publicidadCategorias,
    publicidadUbicaciones,
    publicidadPrioridades,
    moderacion18
  ] = await Promise.all([
    db.listCollection("segmentos"),
    db.listCollection("categorias"),
    db.listCollection("actividades_clave"),
    db.listCollection("acciones"),
    db.listCollection("nodos"),
    db.listCollection("funcionalidades"),
    db.listCollection("niveles_anunciante"),
    db.listCollection("promos_categorias"),
    db.listCollection("eventos_categorias"),
    db.listCollection("lugares"),
    db.listCollection("actividades_categorias"),
    db.listCollection("publicidad_categorias"),
    db.listCollection("publicidad_ubicaciones"),
    db.listCollection("publicidad_prioridades"),
    db.listCollection("eventos_moderacion_palabras")
  ]);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    cache.put(KEYS.commerce, { updated_at: now, segmentos: onlyActive(segmentos), categorias: onlyActive(categorias), actividades_clave: onlyActive(actividades), acciones: onlyActive(acciones), nodos: onlyActive(nodos), funcionalidades: onlyActive(funcionalidades), niveles_anunciante: onlyActive(niveles) }),
    cache.put(KEYS.promos, { updated_at: now, categorias: onlyActive(promosCategorias) }),
    cache.put(KEYS.eventos, { updated_at: now, categorias: onlyActive(eventosCategorias), lugares: onlyActive(lugares), partners: [] }),
    cache.put(KEYS.actividades, { updated_at: now, categorias: onlyActive(actividadesCategorias), lugares: onlyActive(lugares) }),
    cache.put(KEYS.publicidad, { updated_at: now, categorias: onlyActive(publicidadCategorias), ubicaciones: onlyActive(publicidadUbicaciones), prioridades: onlyActive(publicidadPrioridades) }),
    cache.put(KEYS.admin, {
      version: 2,
      updated_at: now,
      segmentos,
      niveles_anunciante: niveles,
      funcionalidades,
      categorias,
      actividades_clave: actividades,
      acciones,
      nodos,
      eventos_categorias: eventosCategorias,
      actividades_categorias: actividadesCategorias,
      moderacion_18: moderacion18
    })
  ]);
  return { success: true, updated_at: now };
}

// reconstruccion/worker/modules/public-catalogs-v2.js
async function publicGuideCatalogsV2({ cache }) {
  const c = await getCommerceCatalogs(cache);
  const segmentos = Array.isArray(c.segmentos) ? c.segmentos : [];
  return {
    success: true,
    segmentos,
    segmentos_publicos: segmentos,
    categorias: Array.isArray(c.categorias) ? c.categorias : [],
    actividades_clave: Array.isArray(c.actividades_clave) ? c.actividades_clave : [],
    acciones: Array.isArray(c.acciones) ? c.acciones : [],
    nodos: Array.isArray(c.nodos) ? c.nodos : [],
    niveles_anunciante: Array.isArray(c.niveles_anunciante) ? c.niveles_anunciante : [],
    source: "kv"
  };
}

// reconstruccion/worker/routes/public-v5.js
async function routePublicV5(ctx) {
  const { path, request: request2, cache } = ctx;
  if (path === "/catalogs/public/guide" && request2.method === "GET") {
    return publicJson(await publicGuideCatalogsV2({ cache }));
  }
  return routePublicV4(ctx);
}

// reconstruccion/worker/modules/publicidad-public-v2.js
var text14 = (v) => String(v ?? "").trim();
var norm = (v) => text14(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
var bool7 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa", "aprobado", "aprobada"].includes(text14(v).toLowerCase());
function parseDate(v) {
  const s = text14(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}
function isWithinValidity(p, now = Date.now()) {
  const desde = parseDate(p && p.vigente_desde), hasta = parseDate(p && p.vigente_hasta);
  if (desde !== null && now < desde) return false;
  if (hasta !== null && now > hasta) return false;
  return true;
}
function isPublic2(p) {
  return text14(p && p.estado).toUpperCase() === "ACTIVA" && bool7(p && p.aprobado) && isWithinValidity(p);
}
function activeSeg(s) {
  return s && (s.activo === void 0 && s.activa === void 0 || bool7(s.activo ?? s.activa));
}
function activeMedia(m) {
  return m && (m.activo === void 0 && m.activa === void 0 || bool7(m.activo ?? m.activa));
}
async function publicidadPublicaV2({ cache, cityId, moduleName, categoryId = "" }) {
  const city = text14(cityId), mod = text14(moduleName).toUpperCase(), cat = text14(categoryId);
  if (!city || !mod) {
    return { success: false, message: "Faltan ciudad_id o modulo.", publicidades: [], status: 400 };
  }
  const [packet2, catalogs] = await Promise.all([
    getPublicityCity({ cache, cityId: city }),
    getPublicidadCatalogs(cache)
  ]);
  if (packet2.status) return packet2;
  const ubicaciones = new Set(
    (catalogs.ubicaciones || []).filter((u) => norm(u.modulo) === norm(mod)).map((u) => text14(u.ubicacion_id || u.id)).filter(Boolean)
  );
  if (!ubicaciones.size) {
    return { success: true, ciudad_id: city, modulo: mod, categoria_id: cat, publicidades: [] };
  }
  const rows = (packet2.publicidades || []).filter(isPublic2).map((p) => {
    const seg = (Array.isArray(p.segmentacion) ? p.segmentacion : []).filter(activeSeg).filter((s) => text14(s.ciudad_id) === city).filter((s) => ubicaciones.has(text14(s.ubicacion_id))).filter((s) => !cat || text14(s.categoria_id) === cat);
    if (!seg.length) return null;
    const media = (Array.isArray(p.media) ? p.media : []).filter(activeMedia).sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
    return { ...p, media, segmentacion: seg };
  }).filter(Boolean);
  return {
    success: true,
    ciudad_id: city,
    modulo: mod,
    categoria_id: cat,
    publicidades: rows
  };
}

// reconstruccion/worker/routes/public-v6.js
var text15 = (v) => String(v ?? "").trim();
async function routePublicV6(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/publicidad" && request2.method === "GET") {
    const action = text15(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") {
      const out2 = await publicidadPublicaV2({
        cache,
        cityId: text15(url.searchParams.get("ciudad_id")),
        moduleName: text15(url.searchParams.get("modulo")),
        categoryId: text15(url.searchParams.get("categoria_id"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV5(ctx);
}

// reconstruccion/worker/core/activities-read-model-v2.js
var text16 = (v) => String(v ?? "").trim();
var bool8 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text16(v).toLowerCase());
var activityCityKeyV2 = (cityId) => "activities:city:v2:" + text16(cityId);
function isPublic3(a) {
  if (!a || !bool8(a.activo) || !bool8(a.aprobado)) return false;
  const estado = text16(a.estado).toUpperCase();
  if (["PAUSADA", "PAUSADO", "INACTIVA", "INACTIVO", "BORRADOR", "ELIMINADA", "ELIMINADO", "RECHAZADA", "RECHAZADO"].includes(estado)) return false;
  const hoy = new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  if (text16(a.vigente_desde) && text16(a.vigente_desde) > hoy) return false;
  if (text16(a.vigente_hasta) && text16(a.vigente_hasta) < hoy) return false;
  return true;
}
function sort5(rows) {
  return [...rows].sort((a, b) => text16(a.nombre).localeCompare(text16(b.nombre), "es", { sensitivity: "base" }));
}
async function syncActivityPreparedV2({ cache, activityId, current = null, next = null, horarios = [], previousCities = [] }) {
  const id4 = text16(activityId || next && next.actividad_id || current && current.actividad_id);
  const currentCities = [...new Set((horarios || []).map((h) => text16(h.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text16), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = activityCityKeyV2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", actividades: [] };
    let rows = (packet2.actividades || []).filter((x) => text16(x.actividad_id || x.id) !== id4);
    if (next && isPublic3(next)) {
      const hs = (horarios || []).filter((h) => text16(h.ciudad_id) === cityId && (h.activo === void 0 || bool8(h.activo)));
      if (hs.length) rows.push({ ...next, horarios: hs });
    }
    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), actividades: sort5(rows) });
  }
  await putPreparedRelationsV1({ cache, type: "activity", id: id4, next, data: horarios });
  return { success: true, ciudades_actualizadas: targets };
}
async function getActivitiesCityV2({ cache, cityId }) {
  const city = text16(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(activityCityKeyV2(city));
  return packet2 ? { success: true, ...packet2, actividades: (packet2.actividades || []).filter(isPublic3) } : { success: true, ciudad_id: city, actividades: [], cold: true };
}
async function rebuildActivitiesAllV2({ db, cache }) {
  const [activities, schedules] = await Promise.all([
    db.listCollection("actividades"),
    db.listCollection("actividad_horarios")
  ]);
  const byAct = /* @__PURE__ */ new Map();
  for (const h of schedules) {
    const id4 = text16(h.actividad_id);
    if (!id4) continue;
    if (!byAct.has(id4)) byAct.set(id4, []);
    byAct.get(id4).push(h);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const a of activities) {
    await putPreparedRelationsV1({ cache, type: "activity", id: text16(a.actividad_id || a.id), next: a, data: byAct.get(text16(a.actividad_id || a.id)) || [] });
    if (!isPublic3(a)) continue;
    const id4 = text16(a.actividad_id || a.id), groups = /* @__PURE__ */ new Map();
    for (const h of byAct.get(id4) || []) {
      if (h.activo !== void 0 && !bool8(h.activo)) continue;
      const city = text16(h.ciudad_id);
      if (!city) continue;
      if (!groups.has(city)) groups.set(city, []);
      groups.get(city).push(h);
    }
    for (const [city, hs] of groups) {
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push({ ...a, horarios: hs });
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, actividades]) => cache.put(activityCityKeyV2(city), {
    version: 2,
    ciudad_id: city,
    updated_at: now,
    actividades: sort5(actividades)
  })));
  return { success: true, ciudades: byCity.size, actividades: activities.length, updated_at: now };
}

// reconstruccion/worker/routes/public-v7.js
var text17 = (v) => String(v ?? "").trim();
async function routePublicV7(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/actividades" && request2.method === "GET") {
    const action = text17(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") {
      const out2 = await getActivitiesCityV2({
        cache,
        cityId: text17(url.searchParams.get("ciudad_id"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV6(ctx);
}

// reconstruccion/worker/core/publicity-read-model-v2.js
var text18 = (v) => String(v ?? "").trim();
var publicityCityKeyV2 = (cityId) => "publicity:city:v2:" + text18(cityId);
function isActive2(p) {
  return text18(p && p.estado).toUpperCase() === "ACTIVA";
}
function sort6(rows) {
  return [...rows].sort((a, b) => text18(a.titulo || a.nombre_interno).localeCompare(text18(b.titulo || b.nombre_interno), "es", { sensitivity: "base" }));
}
async function syncPublicityPreparedV2({
  cache,
  publicityId,
  current = null,
  next = null,
  segmentacion = [],
  media = [],
  previousCities = []
}) {
  const id4 = text18(publicityId || next && next.publicidad_id || current && current.publicidad_id);
  const currentCities = [...new Set((segmentacion || []).map((x) => text18(x.ciudad_id)).filter(Boolean))];
  const targets = [...new Set([...(previousCities || []).map(text18), ...currentCities].filter(Boolean))];
  for (const cityId of targets) {
    const key3 = publicityCityKeyV2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", publicidades: [] };
    let rows = (packet2.publicidades || []).filter((x) => text18(x.publicidad_id || x.id) !== id4);
    if (next && isActive2(next) && currentCities.includes(cityId)) {
      rows.push({
        ...next,
        media: [...media || []],
        segmentacion: (segmentacion || []).filter((x) => text18(x.ciudad_id) === cityId)
      });
    }
    await cache.put(key3, {
      version: 2,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      publicidades: sort6(rows)
    });
  }
  await putPreparedRelationsV1({ cache, type: "publicity-media", id: id4, next, data: media });
  await putPreparedRelationsV1({ cache, type: "publicity-seg", id: id4, next, data: segmentacion });
  return { success: true, ciudades_actualizadas: targets };
}
async function getPublicityCityV2({ cache, cityId }) {
  const city = text18(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(publicityCityKeyV2(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, publicidades: [], cold: true };
}
async function rebuildPublicityAllV2({ db, cache }) {
  const [docs, seg, media] = await Promise.all([
    db.listCollection("publicidades"),
    db.listCollection("publicidad_segmentacion"),
    db.listCollection("publicidad_media")
  ]);
  const segBy = /* @__PURE__ */ new Map(), mediaBy = /* @__PURE__ */ new Map();
  for (const x of seg) {
    const id4 = text18(x.publicidad_id);
    if (!segBy.has(id4)) segBy.set(id4, []);
    segBy.get(id4).push(x);
  }
  for (const x of media) {
    const id4 = text18(x.publicidad_id);
    if (!mediaBy.has(id4)) mediaBy.set(id4, []);
    mediaBy.get(id4).push(x);
  }
  const byCity = /* @__PURE__ */ new Map();
  for (const d of docs) {
    const preparedId = text18(d.publicidad_id || d.id);
    await putPreparedRelationsV1({ cache, type: "publicity-media", id: preparedId, next: d, data: mediaBy.get(preparedId) || [] });
    await putPreparedRelationsV1({ cache, type: "publicity-seg", id: preparedId, next: d, data: segBy.get(preparedId) || [] });
    if (!isActive2(d)) continue;
    const id4 = text18(d.publicidad_id || d.id);
    for (const s of segBy.get(id4) || []) {
      const city = text18(s.ciudad_id);
      if (!city) continue;
      if (!byCity.has(city)) byCity.set(city, []);
      if (!byCity.get(city).some((x) => text18(x.publicidad_id || x.id) === id4)) {
        byCity.get(city).push({
          ...d,
          media: mediaBy.get(id4) || [],
          segmentacion: (segBy.get(id4) || []).filter((x) => text18(x.ciudad_id) === city)
        });
      }
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([...byCity.entries()].map(([city, publicidades]) => cache.put(publicityCityKeyV2(city), {
    version: 2,
    ciudad_id: city,
    updated_at: now,
    publicidades: sort6(publicidades)
  })));
  return { success: true, ciudades: byCity.size, publicidades: docs.length, updated_at: now };
}

// reconstruccion/worker/modules/publicidad-public-v3.js
var text19 = (v) => String(v ?? "").trim();
var norm2 = (v) => text19(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
var bool9 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa", "aprobado", "aprobada"].includes(text19(v).toLowerCase());
function parseDate2(v) {
  const s = text19(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}
function valid(p, now = Date.now()) {
  const desde = parseDate2(p && p.vigente_desde), hasta = parseDate2(p && p.vigente_hasta);
  if (desde !== null && now < desde) return false;
  if (hasta !== null && now > hasta) return false;
  return true;
}
function isPublic4(p) {
  return text19(p && p.estado).toUpperCase() === "ACTIVA" && bool9(p && p.aprobado) && valid(p);
}
function activeSeg2(s) {
  return s && (s.activo === void 0 && s.activa === void 0 || bool9(s.activo ?? s.activa));
}
function activeMedia2(m) {
  return m && (m.activo === void 0 && m.activa === void 0 || bool9(m.activo ?? m.activa));
}
async function publicidadPublicaV3({ cache, cityId, moduleName, categoryId = "" }) {
  const city = text19(cityId), mod = text19(moduleName).toUpperCase(), cat = text19(categoryId);
  if (!city || !mod) return { success: false, message: "Faltan ciudad_id o modulo.", publicidades: [], status: 400 };
  const [packet2, catalogs] = await Promise.all([
    getPublicityCityV2({ cache, cityId: city }),
    getPublicidadCatalogs(cache)
  ]);
  if (packet2.status) return packet2;
  const ubicaciones = new Set(
    (catalogs.ubicaciones || []).filter((u) => norm2(u.modulo) === norm2(mod)).map((u) => text19(u.ubicacion_id || u.id)).filter(Boolean)
  );
  const rows = (packet2.publicidades || []).filter(isPublic4).map((p) => {
    const seg = (Array.isArray(p.segmentacion) ? p.segmentacion : []).filter(activeSeg2).filter((s) => text19(s.ciudad_id) === city).filter((s) => ubicaciones.has(text19(s.ubicacion_id))).filter((s) => !cat || text19(s.categoria_id) === cat);
    if (!seg.length) return null;
    const media = (Array.isArray(p.media) ? p.media : []).filter(activeMedia2).sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
    const first = media[0] || {};
    const tipo = text19(first.tipo_media || p.formato).toUpperCase();
    const url = text19(first.url);
    return {
      ...p,
      media,
      segmentacion: seg,
      ciudad_id: city,
      img: tipo === "IMAGEN" ? url : "",
      media_url: tipo === "IMAGEN" ? "" : url,
      cta: text19(p.cta_destino || p.cta),
      poster: text19(first.poster || p.poster)
    };
  }).filter(Boolean);
  return { success: true, ciudad_id: city, modulo: mod, categoria_id: cat, publicidades: rows };
}

// reconstruccion/worker/routes/public-v9.js
var text20 = (v) => String(v ?? "").trim();
async function routePublicV9(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/publicidad" && request2.method === "GET") {
    const action = text20(url.searchParams.get("action")).toLowerCase();
    if (action === "publicas") {
      const out2 = await publicidadPublicaV3({
        cache,
        cityId: text20(url.searchParams.get("ciudad_id")),
        moduleName: text20(url.searchParams.get("modulo")),
        categoryId: text20(url.searchParams.get("categoria_id"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV7(ctx);
}

// reconstruccion/worker/core/efemerides-read-model-v2.js
var text21 = (v) => String(v ?? "").trim();
var bool10 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text21(v).toLowerCase());
var efemCityKeyV2 = (cityId) => "efemerides:city:v2:" + text21(cityId);
function matchesCity2(e, city, territory) {
  const tipo = text21(e && e.tipo).toUpperCase();
  if (tipo === "GENERAL") return true;
  if (tipo === "LOCAL") return text21(e.ciudad_id) === city;
  if (tipo === "PROVINCIAL") {
    const c = (territory.ciudades || []).find((x) => text21(x.ciudad_id || x.id) === city) || {};
    return text21(e.provincia_id) === text21(c.provincia_id);
  }
  return false;
}
function targetsFor(e, territory) {
  const out2 = /* @__PURE__ */ new Set();
  if (!e) return out2;
  const tipo = text21(e.tipo).toUpperCase();
  if (tipo === "LOCAL" && text21(e.ciudad_id)) out2.add(text21(e.ciudad_id));
  if (tipo === "PROVINCIAL") {
    for (const c of territory.ciudades || []) {
      if (text21(c.provincia_id) === text21(e.provincia_id)) out2.add(text21(c.ciudad_id || c.id));
    }
  }
  if (tipo === "GENERAL") {
    for (const c of territory.ciudades || []) out2.add(text21(c.ciudad_id || c.id));
  }
  return out2;
}
async function syncEfemeridePreparedV2({ cache, efemerideId, previous = null, next = null }) {
  const id4 = text21(efemerideId);
  const territory = await cache.get("territorio:public:v1") || {};
  const targets = /* @__PURE__ */ new Set([...targetsFor(previous, territory), ...targetsFor(next, territory)]);
  for (const city of [...targets].filter(Boolean)) {
    const key3 = efemCityKeyV2(city);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: city, updated_at: "", efemerides: [] };
    let rows = (packet2.efemerides || []).filter((x) => text21(x.efemeride_id || x.id) !== id4);
    if (next && (next.activo === void 0 || bool10(next.activo)) && matchesCity2(next, city, territory)) rows.push(next);
    await cache.put(key3, { version: 2, ciudad_id: city, updated_at: (/* @__PURE__ */ new Date()).toISOString(), efemerides: rows });
  }
  return { success: true, ciudades_actualizadas: [...targets] };
}
async function getEfemCityV2({ cache, cityId }) {
  const city = text21(cityId);
  if (!city) return { success: false, message: "ciudad_id obligatorio", status: 400 };
  const packet2 = await cache.get(efemCityKeyV2(city));
  return packet2 ? { success: true, ...packet2 } : { success: true, ciudad_id: city, efemerides: [], cold: true };
}
async function rebuildEfemeridesAllV3({ db, cache }) {
  const [rows, territory] = await Promise.all([
    db.listCollection("efemerides_bis"),
    cache.get("territorio:public:v1")
  ]);
  if (!territory) throw new Error("Territorio público no inicializado.");
  const active4 = rows.filter((x) => x.activo === void 0 || bool10(x.activo));
  const now = (/* @__PURE__ */ new Date()).toISOString(), writes = [];
  for (const c of territory.ciudades || []) {
    const city = text21(c.ciudad_id || c.id);
    if (!city) continue;
    writes.push(cache.put(efemCityKeyV2(city), {
      version: 2,
      ciudad_id: city,
      updated_at: now,
      efemerides: active4.filter((e) => matchesCity2(e, city, territory))
    }));
  }
  await Promise.all(writes);
  return { success: true, ciudades: writes.length, efemerides: rows.length, activas: active4.length, updated_at: now };
}

// reconstruccion/worker/modules/efemerides-public-v3.js
var text22 = (v) => String(v ?? "").trim();
function dayNumber2(raw) {
  const s = text22(raw).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };
  if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : -1;
}
function dateFrom2(raw) {
  const s = text22(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return /* @__PURE__ */ new Date();
}
function matches2(row, date) {
  const type = text22(row.tipo_fecha).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (type === "FIJA") return Number(row.mes || 0) === date.getMonth() + 1 && Number(row.dia || 0) === date.getDate();
  if (type === "MOVIL") {
    if (Number(row.mes || 0) !== date.getMonth() + 1) return false;
    if (dayNumber2(row.dia_semana) !== date.getDay()) return false;
    const raw = text22(row.semana_mes).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (raw === "ULTIMA") {
      const next = new Date(date);
      next.setDate(next.getDate() + 7);
      return next.getMonth() !== date.getMonth();
    }
    const week = Number(raw || 0);
    return Number.isInteger(week) && week >= 1 && week <= 5 && Math.floor((date.getDate() - 1) / 7) + 1 === week;
  }
  return false;
}
async function efemeridesPublicV3({ cache, cityId, fecha = "" }) {
  const base2 = await getEfemCityV2({ cache, cityId });
  if (base2.status) return base2;
  const date = dateFrom2(fecha);
  const key3 = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return {
    success: true,
    ciudad_id: text22(cityId),
    fecha: key3,
    efemerides: (base2.efemerides || []).filter((x) => matches2(x, date))
  };
}

// reconstruccion/worker/routes/public-v10.js
var text23 = (v) => String(v ?? "").trim();
async function routePublicV10(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/efemerides" && request2.method === "GET") {
    const action = text23(url.searchParams.get("action")).toLowerCase();
    if (["efemerides", "publicas", "public"].includes(action)) {
      const out2 = await efemeridesPublicV3({
        cache,
        cityId: text23(url.searchParams.get("ciudad_id")),
        fecha: text23(url.searchParams.get("fecha"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV9(ctx);
}

// reconstruccion/worker/core/farmacias-read-model-v2.js
const text24=v=>String(v??"").trim();
const farmCityKeyV2=cityId=>"farmacias:city:v2:"+text24(cityId);

async function prepareFarmSedes(cache,city,sedes,guide=null){
  guide=guide||(await cache.get("guide:city:v1:"+text24(city)))||{};
  const names=new Map();
  for(const card of guide.anunciantes||[])for(const sede of card.sedes||[]){
    if(text24(sede.ciudad_id||card.ciudad_id)!==text24(city))continue;
    const id=text24(sede.sede_id||sede.id);
    if(id)names.set(id,{nombre_ref:text24(card.nombre||sede.nombre_ref),nombre_sede:text24(sede.nombre_sede)});
  }
  const used=new Set((sedes||[]).map(row=>text24(row.sede_id||row.id)));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([...names].filter(([id])=>used.has(id)).sort(([a],[b])=>a.localeCompare(b)))));
  const revision="52:"+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
  const useful=v=>text24(v)&&text24(v).toLowerCase()!=="farmacia";
  return{revision,sedes:(sedes||[]).map(row=>{
    const prepared=names.get(text24(row.sede_id||row.id));
    if(!prepared)return row;
    // El nombre de sucursal y el del anunciante son datos distintos.
    return{...row,nombre_ref:prepared.nombre_ref||text24(row.nombre_ref||row.nombre),
      nombre_sede:prepared.nombre_sede||(useful(row.nombre_sede)?text24(row.nombre_sede):"")};
  })};
}

function sortTurnos2(rows){
  return [...rows].sort((a,b)=>{
    const ad=text24(a.fecha_inicio)+" "+text24(a.hora_inicio);
    const bd=text24(b.fecha_inicio)+" "+text24(b.hora_inicio);
    return ad.localeCompare(bd);
  });
}

async function syncFarmCyclePreparedV2({
  cache,
  cycleId,
  current=null,
  next=null,
  participantes=[],
  sedes=[],
  previousCity=""
}){
  const id=text24(cycleId||next&&next.ciclo_id||current&&current.ciclo_id);
  const nextCity=text24(next&&next.ciudad_id);
  const targets=[...new Set([text24(previousCity),text24(current&&current.ciudad_id),nextCity].filter(Boolean))];

  const prepared=await prepareFarmSedes(cache,nextCity||text24(current&&current.ciudad_id),sedes);
  sedes=prepared.sedes;
  for(const city of targets){
    const key=farmCityKeyV2(city);
    const packet=(await cache.get(key))||{version:2,ciudad_id:city,updated_at:"",ciclos:[]};
    let rows=(packet.ciclos||[]).filter(x=>text24(x.ciclo_id||x.id)!==id);

    if(next&&nextCity===city&&next.activo!==false){
      rows.push({...next,participantes:[...(participantes||[])],sedes:[...(sedes||[])]});
    }

    const guide=(await cache.get("guide:city:v1:"+city))||{};
    const completeRows=await Promise.all(rows.map(async c=>({...c,sedes:(await prepareFarmSedes(cache,city,c.sedes,guide)).sedes})));
    await cache.put(key,{
      version:2,
      ciudad_id:city,
      updated_at:new Date().toISOString(),
      ciclos:sortTurnos2(completeRows),
      names_revision:(await prepareFarmSedes(cache,city,completeRows.flatMap(c=>c.sedes||[]),guide)).revision
    });
  }

  await putPreparedRelationsV1({cache,type:"farm",id,next,data:{participantes,sedes}});
  return{success:true,ciudades_actualizadas:targets};
}

async function getFarmCityV2({cache,cityId}){
  const city=text24(cityId);
  if(!city)return{success:false,message:"ciudad_id obligatorio",status:400};
  const key=farmCityKeyV2(city),packet=await cache.get(key);
  if(!packet)return{success:true,ciudad_id:city,ciclos:[],cold:true};
  if(!(packet.ciclos||[]).length)return{success:true,...packet};
  const guide=(await cache.get("guide:city:v1:"+city))||{};
  const context=await prepareFarmSedes(cache,city,packet.ciclos.flatMap(c=>c.sedes||[]),guide);
  if(packet.names_revision===context.revision)return{success:true,...packet};
  // Actualizar únicamente la copia KV del ciclo existente. Nunca Firestore,
  // nunca cambiar fechas, orden o participantes, ni exigir recrear el ciclo.
  const ciclos=await Promise.all(packet.ciclos.map(async c=>({...c,sedes:(await prepareFarmSedes(cache,city,c.sedes,guide)).sedes})));
  const next={...packet,ciclos,names_revision:context.revision};
  try{await cache.put(key,next)}catch(_){} // KV puede propagar lentamente; la respuesta sigue completa.
  return{success:true,...next};
}

async function rebuildFarmAllV2({db,cache}){
  const [cycles,participants,sedes]=await Promise.all([
    db.listCollection("farmacias_ciclos"),
    db.listCollection("farmacias_ciclo_sedes"),
    db.listCollection("anunciantes_sedes")
  ]);

  const partBy=new Map();
  for(const p of participants){
    const id=text24(p.ciclo_id);
    if(!partBy.has(id))partBy.set(id,[]);
    partBy.get(id).push(p);
  }

  const sedeMap=new Map(sedes.map(s=>[text24(s.sede_id||s.id),s]));
  const byCity=new Map();

  for(const c of cycles){
    const preparedId=text24(c.ciclo_id||c.id),preparedParts=partBy.get(preparedId)||[];
    const prepared=await prepareFarmSedes(cache,text24(c.ciudad_id),preparedParts.map(p=>sedeMap.get(text24(p.sede_id))).filter(Boolean));
    await putPreparedRelationsV1({cache,type:"farm",id:preparedId,next:c,data:{
      participantes:preparedParts,sedes:prepared.sedes
    }});
    if(c.activo===false)continue;
    const city=text24(c.ciudad_id);
    if(!city)continue;
    const ps=partBy.get(text24(c.ciclo_id||c.id))||[];
    const ss=prepared.sedes;
    if(!byCity.has(city))byCity.set(city,[]);
    byCity.get(city).push({...c,participantes:ps,sedes:ss});
  }

  const now=new Date().toISOString();
  await Promise.all([...byCity.entries()].map(async ([city,ciclos])=>cache.put(farmCityKeyV2(city),{
    version:2,ciudad_id:city,updated_at:now,ciclos:sortTurnos2(ciclos),names_revision:(await prepareFarmSedes(cache,city,ciclos.flatMap(c=>c.sedes||[]))).revision
  })));

  return{success:true,ciudades:byCity.size,ciclos:cycles.length,updated_at:now};
}

// reconstruccion/worker/modules/farmacias-public-v3.js
var text25 = (v) => String(v ?? "").trim();
function parseLocalDateTime(dateStr, timeStr) {
  const d = text25(dateStr), t = text25(timeStr) || "00:00";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const h = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m || !h) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]), 0, 0);
}
function fmtDate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtTime(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function requestedDay(dateStr) {
  const m = text25(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1e3);
  return { start, end };
}
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}
function sedeMap(cycle) {
  return new Map((cycle.sedes || []).map((s) => [text25(s.sede_id || s.id), s]));
}
function sortedParticipants(cycle) {
  return [...cycle.participantes || []].filter((p) => p && p.activo !== false && text25(p.sede_id)).sort((a, b) => Number(a.orden || 999999) - Number(b.orden || 999999));
}
function turnosForCycle(cycle, dateStr, now = Date.now()) {
  const parts = sortedParticipants(cycle);
  const n = parts.length;
  if (!n) return [];
  const simultaneous = Math.max(1, Math.min(n, Math.floor(Number(cycle.farmacias_por_turno || 1))));
  const durationHours = Math.max(1, Number(cycle.duracion_horas || 24));
  const durationMs = durationHours * 60 * 60 * 1e3;
  const cycleStart = parseLocalDateTime(cycle.fecha_inicio, cycle.hora_inicio);
  const day = requestedDay(dateStr);
  if (!cycleStart || !day) return [];
  const firstSlot = Math.floor((day.start.getTime() - cycleStart.getTime()) / durationMs) - 1;
  const lastSlot = Math.floor((day.end.getTime() - cycleStart.getTime()) / durationMs) + 1;
  const totalSteps = n / gcd(n, simultaneous);
  const sedes = sedeMap(cycle);
  const rows = [];
  for (let slot = Math.max(0, firstSlot); slot <= Math.max(0, lastSlot); slot++) {
    const start = new Date(cycleStart.getTime() + slot * durationMs);
    const end = new Date(start.getTime() + durationMs);
    if (end <= day.start || start >= day.end) continue;
    const step = slot % totalSteps;
    const index = step * simultaneous % n;
    for (let j = 0; j < simultaneous; j++) {
      const part = parts[(index + j) % n];
      const sede = sedes.get(text25(part.sede_id));
      if (!sede) continue;
      rows.push({
        ...sede,
        ciclo_id: text25(cycle.ciclo_id || cycle.id),
        sede_id: text25(sede.sede_id || sede.id),
        fecha_desde: fmtDate(start),
        hora_desde: fmtTime(start),
        fecha_hasta: fmtDate(end),
        hora_hasta: fmtTime(end),
        observaciones: text25(cycle.observaciones),
        en_turno_ahora: now >= start.getTime() && now < end.getTime()
      });
    }
  }
  return rows;
}
async function farmTurnosPublicV3({ cache, cityId, fecha = "" }) {
  const city = text25(cityId);
  const date = text25(fecha) || fmtDate(/* @__PURE__ */ new Date());
  const base2 = await getFarmCityV2({ cache, cityId: city });
  if (base2.status) return base2;
  const turnos = (base2.ciclos || []).filter((c) => c.activo !== false).flatMap((c) => turnosForCycle(c, date)).sort((a, b) => {
    const ka = text25(a.fecha_desde) + " " + text25(a.hora_desde) + " " + text25(a.nombre_sede);
    const kb = text25(b.fecha_desde) + " " + text25(b.hora_desde) + " " + text25(b.nombre_sede);
    return ka.localeCompare(kb, "es", { sensitivity: "base" });
  });
  return { success: true, ciudad_id: city, fecha: date, turnos };
}

// reconstruccion/worker/routes/public-v12.js
var text26 = (v) => String(v ?? "").trim();
async function routePublicV12(ctx) {
  const { path, request: request2, url, cache } = ctx;
  if (path === "/farmacias" && request2.method === "GET") {
    const action = text26(url.searchParams.get("action")).toLowerCase();
    if (action === "turnos") {
      const out2 = await farmTurnosPublicV3({
        cache,
        cityId: text26(url.searchParams.get("ciudad_id")),
        fecha: text26(url.searchParams.get("fecha"))
      });
      return out2.status ? json(out2, out2.status) : publicJson(out2);
    }
  }
  return routePublicV10(ctx);
}

// reconstruccion/worker/core/subscriber-session-state.js
var key2 = (sid) => "subscriber:session-state:v1:" + String(sid || "").trim();
async function subscriberSessionState(env, sid) {
  const kv = env.GLD_CACHE_KV;
  if (!kv) throw new Error("Falta binding GLD_CACHE_KV.");
  const raw = await kv.get(key2(sid));
  if (!raw) return { version: 0, deleted: false };
  return JSON.parse(raw);
}
async function revokeSubscriberSessions(env, sid, { deleted = false } = {}) {
  const current = await subscriberSessionState(env, sid);
  await env.GLD_CACHE_KV.put(key2(sid), JSON.stringify({
    version: Number(current.version || 0) + 1,
    deleted: deleted || current.deleted === true
  }));
}

// reconstruccion/worker/modules/suscriptores.js
var C2 = {
  suscriptores: "suscriptores",
  relaciones: "suscriptor_anunciante",
  anunciantes: "anunciantes",
  admin: "anunciantes_administracion"
};
var text27 = (v) => String(v ?? "").trim();
var norm3 = (v) => text27(v).toLowerCase();
function truthy(v) {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "yes", "x", "activo", "activa"].includes(norm3(v));
}
function publicSubscriber(s) {
  return {
    suscriptor_id: text27(s.suscriptor_id || s.id),
    nombre: text27(s.nombre),
    mail: text27(s.mail),
    whatsapp: text27(s.whatsapp),
    tipo_usuario: text27(s.tipo_usuario),
    ciudad_origen_id: text27(s.ciudad_origen_id),
    ciudad_predeterminada_id: text27(s.ciudad_predeterminada_id),
    activo: s.activo
  };
}
function b642(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  bytes.forEach((x) => bin += String.fromCharCode(x));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64decode2(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac2(env, value) {
  const secret = text27(env.SERVER_SECRET);
  if (!secret) throw new Error("Falta SERVER_SECRET");
  const key3 = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key3, new TextEncoder().encode(value));
  return b642(new Uint8Array(sig));
}
async function issueSession(env, payload, hours = 8) {
  const now = Date.now();
  const body = b642(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + hours * 60 * 60 * 1e3,
    typ: "GLD_SUBSCRIBER"
  }));
  return body + "." + await hmac2(env, body);
}
async function verifySubscriberSession(env, request2) {
  const auth = text27(request2.headers.get("Authorization"));
  if (!auth.toLowerCase().startsWith("bearer ")) return { ok: false, message: "Sesión requerida" };
  const parts = auth.slice(7).trim().split(".");
  if (parts.length !== 2) return { ok: false, message: "Sesión inválida" };
  const [body, sig] = parts;
  if (sig !== await hmac2(env, body)) return { ok: false, message: "Sesión inválida" };
  let p = null;
  try {
    p = JSON.parse(b64decode2(body));
  } catch (_) {
  }
  if (!p || p.typ !== "GLD_SUBSCRIBER" || !p.sid || !p.exp || Date.now() > Number(p.exp)) {
    return { ok: false, message: "Sesión inválida o vencida" };
  }
  const state = await subscriberSessionState(env, p.sid);
  if (state.deleted || Number(p.sv || 0) !== Number(state.version || 0)) return { ok: false, message: "Sesión cerrada. Volvé a ingresar." };
  return { ok: true, ...p };
}
function relationPermissions(rel, admin) {
  const raw = text27(rel.permisos) || text27(admin && admin.funcionalidades);
  return raw.split(/[;,|\n]/).map((x) => text27(x).toUpperCase()).filter(Boolean);
}
async function subscriberLogin({ env, db, body }) {
  const mail = norm3(body.mail), clave = text27(body.clave);
  if (!mail || !clave) return { success: false, message: "Falta mail o clave" };
  const matches3 = await db.queryEqual(C2.suscriptores, "mail", mail, 5);
  const sus = matches3.find((x) => norm3(x.mail) === mail);
  if (!sus || text27(sus.clave) !== clave) return { success: false, message: "Mail o clave incorrectos" };
  if (sus.activo !== void 0 && sus.activo !== null && sus.activo !== "" && !truthy(sus.activo)) {
    return { success: false, message: "Suscriptor no activo" };
  }
  const sid = text27(sus.suscriptor_id || sus.id);
  const relations = (await db.queryEqual(C2.relaciones, "suscriptor_id", sid, 100)).filter((r) => text27(r.anunciante_id) && truthy(r.activo));
  const enriched = await Promise.all(relations.map(async (rel) => {
    const aid = text27(rel.anunciante_id);
    const [advertiser, admin] = await Promise.all([
      db.get(C2.anunciantes, aid),
      db.get(C2.admin, aid)
    ]);
    return {
      suscriptor_id: sid,
      anunciante_id: aid,
      anunciante_nombre: text27(rel.anunciante_nombre || advertiser && advertiser.nombre || admin && admin.nombre),
      rol: text27(rel.rol).toUpperCase(),
      permisos: relationPermissions(rel, admin).join(", "),
      administracion: admin || {},
      activo: true
    };
  }));
  const tokenPayload = {
    sid,
    auth: enriched.map((x) => ({
      anunciante_id: x.anunciante_id,
      rol: x.rol,
      permisos: x.permisos
    }))
  };
  const token2 = await issueSession(env, tokenPayload);
  return {
    success: true,
    suscriptor: publicSubscriber(sus),
    anunciantes: enriched,
    token: token2,
    expires_in_seconds: 8 * 60 * 60,
    source: "firestore"
  };
}
async function subscriberSession({ env, request: request2 }) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { success: false, message: s.message, status: 401 };
  return {
    success: true,
    suscriptor_id: s.sid,
    autorizaciones: Array.isArray(s.auth) ? s.auth : [],
    expires_at: s.exp
  };
}
function sessionAllows(session2, advertiserId, moduleName, { write = false } = {}) {
  if (!session2 || !session2.ok) return false;
  const aid = text27(advertiserId);
  const rel = (session2.auth || []).find((x) => text27(x.anunciante_id) === aid);
  if (!rel) return false;
  const role = text27(rel.rol).toUpperCase();
  if (!["PROPIETARIO", "ADMINISTRADOR", "MANAGER"].includes(role)) return false;
  if (write && moduleName === "modificar_datos" && role === "MANAGER") return false;
  if (moduleName === "modificar_datos") return role === "PROPIETARIO" || role === "ADMINISTRADOR";
  const aliases = {
    promos: ["PROMOS"],
    eventos: ["EVENTOS"],
    eventos_free: ["EVENTOS_FREE", "EV_FREE", "EVFREE"],
    actividades: ["ACTIVIDADES"],
    publicidad: ["PUBLICIDAD"],
    turnos_farma: ["TURNOS_FARMA", "FARMACIAS", "FARMACIA"],
    efemerides: ["EFEMERIDES", "EF LOCAL", "EF GENERAL", "EF_LOCAL", "EF_GENERAL"]
  };
  const perms2 = new Set(text27(rel.permisos).split(/[;,|\n]/).map((x) => text27(x).toUpperCase()).filter(Boolean));
  return (aliases[moduleName] || []).some((x) => perms2.has(x));
}

// reconstruccion/worker/modules/commerce-v2.js
function text28(v) {
  return String(v ?? "").trim();
}
function ids2(v) {
  if (Array.isArray(v)) return [...new Set(v.map(text28).filter(Boolean))];
  return [...new Set(text28(v).split(/[;,|\n]/).map(text28).filter(Boolean))];
}
function newSedeId(advertiserId) {
  return "SED-" + text28(advertiserId) + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}
async function commercePanelData({ db, advertiserId, catalogs }) {
  const [datos, administracion, sedes] = await Promise.all([
    db.get("anunciantes", advertiserId),
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId)
  ]);
  if (!datos) return { success: false, error: "anunciante_no_encontrado" };
  return {
    success: true,
    advertiser: {
      id: advertiserId,
      datos,
      administracion: administracion || {},
      sedes,
      segmentos: catalogs.segmentos || [],
      categorias: catalogs.categorias || [],
      actividades_clave: catalogs.actividades_clave || [],
      acciones: catalogs.acciones || [],
      nodos: catalogs.nodos || [],
      funcionalidades: catalogs.funcionalidades || [],
      niveles_anunciante: catalogs.niveles_anunciante || []
    }
  };
}
async function commerceSetDatos({ db, advertiserId, body }) {
  const reserved = /* @__PURE__ */ new Set(["action", "accion", "id", "__id", "comercio_id", "advertiserId", "advertiser_id"]);
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  for (const [k, v] of Object.entries(body || {})) {
    if (reserved.has(k)) continue;
    if (k === "categoria_id") patch.categoria_ids = ids2(v);
    else patch[k] = v;
  }
  const saved = await db.patch("anunciantes", advertiserId, patch, { mustExist: true });
  return { success: true, updated: true, id: advertiserId, advertiser: saved };
}
async function commerceSetSedes({ db, advertiserId, body }) {
  const incoming = Array.isArray(body && body.sedes) ? body.sedes : [];
  const saved = [];
  for (const raw of incoming) {
    const existingId = text28(raw && raw.sede_id);
    const id4 = existingId || newSedeId(advertiserId);
    if (existingId) {
      const current = await db.get("anunciantes_sedes", id4);
      if (!current || text28(current.anunciante_id) !== text28(advertiserId)) {
        throw new Error("La sede no pertenece al anunciante.");
      }
    }
    const patch = {
      ...raw || {},
      sede_id: id4,
      anunciante_id: advertiserId,
      actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
    };
    if ("actividad_ids" in patch) patch.actividad_ids = ids2(patch.actividad_ids);
    if ("accion_ids" in patch) patch.accion_ids = ids2(patch.accion_ids);
    if ("nodo_ids" in patch) patch.nodo_ids = ids2(patch.nodo_ids);
    delete patch.__id;
    await db.patch("anunciantes_sedes", id4, patch, { mustExist: !!existingId });
    saved.push(id4);
  }
  return { success: true, updated: true, id: advertiserId, sedes: saved };
}
async function commerceSetRelacionesSede({ db, advertiserId, body }) {
  const id4 = text28(body && body.sede_id);
  if (!id4) throw new Error("Falta sede_id.");
  const current = await db.get("anunciantes_sedes", id4);
  if (!current || text28(current.anunciante_id) !== text28(advertiserId)) {
    throw new Error("La sede no pertenece al anunciante.");
  }
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  if (body.actividad_ids !== void 0) patch.actividad_ids = ids2(body.actividad_ids);
  if (body.accion_ids !== void 0) patch.accion_ids = ids2(body.accion_ids);
  if (body.nodo_ids !== void 0) patch.nodo_ids = ids2(body.nodo_ids);
  await db.patch("anunciantes_sedes", id4, patch, { mustExist: true });
  return { success: true, updated: true, sede_id: id4 };
}
async function commerceDeleteSede({ db, advertiserId, body }) {
  const id4 = text28(body && body.sede_id);
  if (!id4) throw new Error("Falta sede_id.");
  const current = await db.get("anunciantes_sedes", id4);
  if (!current || text28(current.anunciante_id) !== text28(advertiserId)) {
    throw new Error("La sede no pertenece al anunciante.");
  }
  await db.delete("anunciantes_sedes", id4, { mustExist: true });
  return { success: true, deleted: true, sede_id: id4 };
}

// reconstruccion/worker/core/changed-fields-v1.js
function comparable(v) {
  if (Array.isArray(v)) return v.map(comparable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, comparable(v[k])]));
  return v;
}
function sameValueV1(a, b) {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}
function changedFieldsV1(current, next, { timestamps = ["actualizado", "actualizado_en"], touch = false, fields = null } = {}) {
  if (!current) return { ...next };
  const patch = {};
  for (const [k, v] of Object.entries(next)) {
    if (k === "id" || timestamps.includes(k) || v === void 0) continue;
    if (fields && !fields.includes(k)) continue;
    if (!sameValueV1(current[k], v)) patch[k] = v;
  }
  if (Object.keys(patch).length || touch) for (const k of timestamps) {
    if (next[k] !== void 0) patch[k] = next[k];
  }
  return patch;
}

// reconstruccion/worker/modules/promos-v2.js
var text29 = (v) => String(v ?? "").trim();
var bool11 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text29(v).toLowerCase());
var paused = (p) => bool11(p && p.pausado);
function categoryFrom(catalogs, value) {
  const needle = text29(value);
  const norm14 = (s) => text29(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (catalogs.categorias || []).find(
    (c) => text29(c.categoria_id || c.id) === needle || norm14(c.nombre || c.titulo || c.categoria || c.id) === norm14(needle)
  ) || null;
}
function cityExists(territory, cityId) {
  return (territory.ciudades || []).some((c) => text29(c.ciudad_id || c.id) === text29(cityId));
}
function promoId() {
  return "PRO-" + crypto.randomUUID();
}
async function promosPanelDataV2({ db, cache, advertiserId, cupoFromAdmin }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin, advertiser, sedes, promos, catalogs] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.get("anunciantes", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId,500),
    db.queryEqual("promos", "anunciante_id", advertiserId,500),
    cache.get("catalogs:promos:v1")
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  return {
    success: true,
    advertiser: advertiser || { id: advertiserId },
    sedes,
    categorias: catalogs && catalogs.categorias || [],
    promos,
    promos_cant: Number(cupoFromAdmin(admin) || 0),
    promos_guardadas_max: limiteGuardadasV62(admin,"PROMOS",cupoFromAdmin(admin))
  };
}
async function validateContext({ db, cache, advertiserId, data }) {
  const [territory, catalogs] = await Promise.all([
    cache.get("territorio:public:v1"),
    cache.get("catalogs:promos:v1")
  ]);
  const cityId = text29(data.ciudad_id);
  if (!cityId || !territory || !cityExists(territory, cityId)) throw new Error("La ciudad indicada no existe o no está activa.");
  const cat = categoryFrom(catalogs || {}, data.categoria_id || data.categoria);
  if (!cat) throw new Error("La categoría indicada no existe.");
  const sedeId = text29(data.sede_id);
  if (sedeId) {
    const sedes = await db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId, 500);
    const sede = sedes.find(s => text30(s.sede_id || s.id) === sedeId);
    if (!sede || text29(sede.anunciante_id) !== text29(advertiserId)) throw new Error("La sede no pertenece al anunciante.");
    if (text29(sede.ciudad_id) !== cityId) throw new Error("La sede no pertenece a la ciudad indicada.");
  }
  return {
    cityId,
    categoria_id: text29(cat.categoria_id || cat.id),
    categoria: text29(cat.nombre || cat.titulo || cat.categoria),
    logo_categoria: text29(cat.logo)
  };
}
async function quota({ db, advertiserId, cupoFromAdmin, excludeId = "" }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin, promos] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("promos", "anunciante_id", advertiserId,500)
  ]);
  const max = Number(cupoFromAdmin(admin || {}) || 0);
  const active4 = promos.filter((p) => text29(p.promo_id || p.id) !== text29(excludeId) && !paused(p)).length;
  return { max, active: active4, total:promos.length, totalMax:limiteGuardadasV62(admin,"PROMOS",max) };
}
async function promoCreateV2({ db, cache, advertiserId, body, cupoFromAdmin }) {
  const data = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  if (text29(data.promo_id)) throw new Error("El alta de una promo no admite promo_id; usá editar para una promo existente.");
  const ctx = await validateContext({ db, cache, advertiserId, data });
  const q = await quota({ db, advertiserId, cupoFromAdmin });
  if (q.max <= 0 || q.active >= q.max) throw new Error("Alcanzaste el máximo de promos activas.");
  if(q.total>=q.totalMax)throw new Error("Alcanzaste el máximo de promociones guardadas.");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    ...data,
    promo_id: promoId(),
    anunciante_id: advertiserId,
    id_comercio: advertiserId,
    ciudad_id: ctx.cityId,
    categoria_id: ctx.categoria_id,
    categoria: ctx.categoria,
    logo_categoria: ctx.logo_categoria,
    pausado: bool11(data.pausado),
    creado: text29(data.creado) || now,
    actualizado: now
  };
  const saved = await db.patch("promos", doc.promo_id, doc, {newDocument:true});
  await syncPromo({ cache, next: saved });
  return { success: true, promo: saved };
}
async function promoUpdateV2({ db, cache, advertiserId, body, cupoFromAdmin }) {
  const data = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const id4 = text29(data.promo_id);
  if (!id4) throw new Error("Falta promo_id.");
  const current = await db.get("promos", id4);
  if (!current || text29(current.anunciante_id || current.id_comercio) !== text29(advertiserId)) throw new Error("La promo no pertenece al anunciante.");
  const allowed = [
    "promo",
    "categoria",
    "categoria_id",
    "sede_id",
    "ciudad_id",
    "img",
    "desde",
    "hasta",
    "otros",
    "instagram",
    "facebook",
    "youtube",
    "tiktok",
    "linkedin",
    "x",
    "direccion",
    "maps",
    "telefono",
    "telefono1",
    "telefono2",
    "telefono3",
    "telefono4",
    "whatsapp",
    "whatsapp2",
    "whatsapp3",
    "pausado"
  ];
  const next = { ...current };
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(data, k)) next[k] = data[k];
  const contextChanged = ["ciudad_id", "categoria_id", "categoria", "sede_id"].some((k) => Object.prototype.hasOwnProperty.call(data, k) && !sameValueV1(data[k], current[k]));
  if (contextChanged) {
    const contextData = { ...next };
    if (Object.prototype.hasOwnProperty.call(data, "categoria") && !Object.prototype.hasOwnProperty.call(data, "categoria_id")) delete contextData.categoria_id;
    const ctx = await validateContext({ db, cache, advertiserId, data: contextData });
    next.ciudad_id = ctx.cityId;
    next.categoria_id = ctx.categoria_id;
    next.categoria = ctx.categoria;
    next.logo_categoria = ctx.logo_categoria;
  }
  if (Object.prototype.hasOwnProperty.call(data, "pausado") && !bool11(data.pausado) && paused(current)) {
    const q = await quota({ db, advertiserId, cupoFromAdmin, excludeId: id4 });
    if (q.active >= q.max) throw new Error("Alcanzaste el máximo de promos activas.");
  }
  if (Object.prototype.hasOwnProperty.call(data, "pausado")) next.pausado = bool11(next.pausado);
  next.actualizado = (/* @__PURE__ */ new Date()).toISOString();
  const patch = changedFieldsV1(current, next);
  if (!Object.keys(patch).length) return { success: true, updated: false, promo_id: id4, promo: current };
  const saved = await db.patch("promos", id4, patch, { mustExist: true });
  await syncPromo({ cache, current, next: saved });
  return { success: true, promo_id: id4, promo: saved };
}
async function promoDeleteV2({ db, cache, advertiserId, body }) {
  const data = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const id4 = text29(data.promo_id);
  if (!id4) throw new Error("Falta promo_id.");
  const current = await db.get("promos", id4);
  if (!current || text29(current.anunciante_id || current.id_comercio) !== text29(advertiserId)) throw new Error("La promo no pertenece al anunciante.");
  await db.delete("promos", id4, { mustExist: true });
  await syncPromo({ cache, current, next: null });
  return { success: true, promo_id: id4 };
}

// reconstruccion/worker/modules/eventos.js
async function eventosPanelData({ db, advertiserId, catalogs, featureEnabled: featureEnabled3, cupo: cupo3, enrichPrograms }) {
  const [admin, advertiser, eventos, sedes] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.get("anunciantes", advertiserId),
    db.queryEqual("eventos", "anunciante_id", advertiserId),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId)
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  const vip = eventos.filter((e) => String(e.nivel || "").toUpperCase() !== "FREE");
  const free = eventos.filter((e) => String(e.nivel || "").toUpperCase() === "FREE");
  if (enrichPrograms) await enrichPrograms(vip);
  return {
    success: true,
    advertiser: advertiser || { id: advertiserId },
    funcionalidades: {
      eventos: !!featureEnabled3(admin, "EVENTOS"),
      eventos_free: !!featureEnabled3(admin, "EVENTOS_FREE")
    },
    eventos_cant: Number(cupo3(admin, "EVENTOS") || 0),
    eventos_free_cant: Number(cupo3(admin, "EVENTOS_FREE") || 0),
    eventos_guardadas_max:limiteGuardadasV62(admin,"EVENTOS",cupo3(admin,"EVENTOS")),
    eventos_free_guardadas_max:limiteGuardadasV62(admin,"EVENTOS_FREE",cupo3(admin,"EVENTOS_FREE")),
    categorias: catalogs.categorias || [],
    lugares: [...catalogs.lugares || [], ...sedes],
    partners: catalogs.partners || [],
    eventos: vip,
    eventos_free: free
  };
}

// reconstruccion/worker/modules/eventos-v3.js
var text30 = (v) => String(v ?? "").trim();
var bool12 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text30(v).toLowerCase());
var isFree = (e) => text30(e && e.nivel).toUpperCase() === "FREE";
var isVip = (e) => !isFree(e);
var norm4 = (v) => text30(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
function id(prefix) {
  return prefix + "-" + crypto.randomUUID();
}
function cityExists2(territory, cid) {
  return (territory && territory.ciudades || []).some((c) => text30(c.ciudad_id || c.id) === text30(cid));
}
async function validateLocation({ db, cache, advertiserId, row, fallbackCity = "" }) {
  const city = text30(row.ciudad_id || fallbackCity);
  if (!city) throw new Error("Falta ciudad.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || !cityExists2(territory, city)) throw new Error("La ciudad indicada no existe o no está activa.");
  const tipo = text30(row.tipo_lugar).toUpperCase();
  const sedeId = text30(row.sede_id), lugarId = text30(row.lugar_id), lugarTexto = text30(row.lugar_texto || row.lugar), direccion = text30(row.direccion);
  if (tipo.includes("VIRTUAL") || tipo.includes("ONLINE")) {
    if (!text30(row.url_virtual || row.link_virtual || row.enlace_virtual || row.web || row.maps)) throw new Error("El evento virtual necesita enlace o plataforma.");
    return city;
  }
  if (sedeId) {
    const sedes = await db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId, 500);
    const sede = sedes.find(s => text30(s.sede_id || s.id) === sedeId);
    if (!sede || text30(sede.anunciante_id) !== text30(advertiserId) || text30(sede.ciudad_id) !== city) throw new Error("La sede no pertenece al anunciante/ciudad.");
    return city;
  }
  if (lugarId) {
    const catalog = await getEventosCatalogs(cache);
    const lugar = (catalog.lugares || []).find(l => text30(l.lugar_id || l.id) === lugarId);
    if (!lugar || text30(lugar.ciudad_id) !== city) throw new Error("El lugar no pertenece a la ciudad.");
    return city;
  }
  if (!lugarTexto) throw new Error("Falta indicar el lugar del evento.");
  if (!direccion) throw new Error("El lugar necesita dirección física.");
  return city;
}
async function validateEvent({ db, cache, advertiserId, data, validateLocations = true, previousProgramacion = [] }) {
  if (!text30(data.nombre_evento)) throw new Error("Falta nombre del evento.");
  if (!text30(data.categoria || data.categoria_id)) throw new Error("Falta categoría.");
  if (!text30(data.ciudad_id)) throw new Error("Falta ciudad.");
  if (!text30(data.fecha_desde)) throw new Error("Falta fecha del evento.");
  if (!validateLocations) return;
  const programacion = Array.isArray(data.programacion) ? data.programacion : [];
  const programIds = programacion.map((p) => text30(p?.evento_programacion_id || p?.id)).filter(Boolean);
  if (new Set(programIds).size !== programIds.length) throw new Error("Instancia repetida en la programación.");
  if (programacion.length) {
    for (let i = 0; i < programacion.length; i++) {
      const row = programacion[i] || {};
      if (!text30(row.fecha)) throw new Error("Falta fecha en la instancia " + (i + 1) + ".");
      const previous = previousProgramacion.find((p) => text30(p.evento_programacion_id || p.id) === text30(row.evento_programacion_id || row.id));
      const placeKeys = ["ciudad_id", "tipo_lugar", "sede_id", "lugar_id", "lugar_texto", "lugar", "direccion", "maps", "url_virtual", "link_virtual", "enlace_virtual", "web"];
      if (previous && placeKeys.every((k) => text30(previous[k]) === text30(row[k]))) continue;
      await validateLocation({ db, cache, advertiserId, row, fallbackCity: data.ciudad_id });
    }
  } else {
    await validateLocation({ db, cache, advertiserId, row: data, fallbackCity: data.ciudad_id });
  }
}
async function replaceProgramacion({ db, cache, advertiserId, eventId, programacion, fallbackCity, previous = void 0 }) {
  const old = previous ?? await db.queryEqual("evento_programacion", "evento_id", eventId, 500);
  const byId = new Map(old.map((p) => [text30(p.evento_programacion_id || p.id), p]));
  const kept = /* @__PURE__ */ new Set(), saved = [];
  let orden = 0, changed = false;
  for (const raw of Array.isArray(programacion) ? programacion : []) {
    const city = text30(raw.ciudad_id || fallbackCity);
    const requested = text30(raw.evento_programacion_id || raw.id);
    const current = byId.get(requested);
    const pid = current ? requested : id("evp");
    if (kept.has(pid)) throw new Error("Instancia repetida en la programación.");
    kept.add(pid);
    const { id: legacyId, evento_programacion_id: legacyProgramId, actualizado, ...fields } = raw;
    orden++;
    const patch = {
      ...fields,
      evento_programacion_id: pid,
      evento_id: eventId,
      ciudad_id: city,
      sede_id: text30(raw.sede_id),
      lugar_id: text30(raw.lugar_id),
      lugar_texto: text30(raw.lugar_texto || raw.lugar),
      direccion: text30(raw.direccion),
      maps: text30(raw.maps),
      fecha: text30(raw.fecha),
      hora_desde: text30(raw.hora_desde),
      hora_hasta: text30(raw.hora_hasta),
      activo: raw.activo === false ? false : true,
      orden: Number(raw.orden || orden)
    };
    if (current && Object.entries(patch).every(([k, v]) => JSON.stringify(current[k]) === JSON.stringify(v))) {
      saved.push(current);
      continue;
    }
    saved.push(await db.patch("evento_programacion", pid, changedFieldsV1(current, { ...patch, actualizado: (/* @__PURE__ */ new Date()).toISOString() }), { mustExist: !!current, newDocument: !current }));
    changed = true;
  }
  for (const [pid] of byId) if (!kept.has(pid)) {
    await db.delete("evento_programacion", pid);
    changed = true;
  }
  Object.defineProperty(saved, "changed", { value: changed });
  return saved;
}
async function quota2({ db, advertiserId, max, free = false, exclude = "" }) {
  const own = await db.queryEqual("eventos", "anunciante_id", advertiserId, 500);
  const admin=await (db.panelReadDb?db.panelReadDb():db).get("anunciantes_administracion",advertiserId);
  const rows = own.filter((e) => free ? isFree(e) : isVip(e));
  return {
    total: rows.length,
    active: rows.filter((e) => text30(e.evento_id || e.id) !== text30(exclude) && !bool12(e.pausado)).length,
    max: Number(max || 0),
    totalMax: limiteGuardadasV62(admin,free?"EVENTOS_FREE":"EVENTOS",max)
  };
}
async function similarFree({ db, data }) {
  const city = text30(data.ciudad_id);
  if (!city) return [];
  const rows = await db.queryEqual("eventos", "ciudad_id", city, 500);
  const n = norm4(data.nombre_evento), place = norm4(data.lugar || data.lugar_texto), date = text30(data.fecha_desde);
  return rows.filter(isFree).filter((e) => {
    const sameDate = date && text30(e.fecha_desde) === date;
    return sameDate && (n && norm4(e.nombre_evento) === n || place && norm4(e.lugar || e.lugar_texto) === place);
  }).slice(0, 5);
}
async function createEventV3({ db, cache, advertiserId, payload, max, advertiser, level = "VIP" }) {
  const data = payload && typeof payload === "object" ? payload : {};
  const free = level === "FREE";
  if (Number(max || 0) <= 0) throw new Error("El anunciante no tiene cupo de " + (free ? "Eventos Free" : "Eventos") + ".");
  await validateEvent({ db, cache, advertiserId, data });
  const q = await quota2({ db, advertiserId, max, free });
  if (q.max <= 0) throw new Error("El anunciante no tiene cupo de " + (free ? "Eventos Free" : "Eventos") + ".");
  if (q.active >= q.max) throw new Error("Alcanzaste el máximo de eventos activos.");
  if (q.total >= q.totalMax) throw new Error("Alcanzaste el máximo de eventos guardados.");
  if (free && !bool12(data.confirmar_similar)) {
    const dup = await similarFree({ db, data });
    if (dup.length) return { success: false, requires_confirmation: true, duplicados: dup };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString(), eventId = id(free ? "free" : "vip");
  const doc = {
    ...data,
    evento_id: eventId,
    anunciante_id: advertiserId,
    id_anunciante: advertiserId,
    nivel: free ? "FREE" : "VIP",
    estado_moderacion: "PENDIENTE",
    estado: "PENDIENTE",
    pausado: false,
    acepta_responsabilidad: free ? bool12(data.acepta_responsabilidad) : true,
    fecha_aceptacion: now,
    fecha_carga: now,
    actualizado: now,
    organizador: text30(data.organizador || advertiser && advertiser.nombre),
    logo_organizador: text30(data.logo_organizador || advertiser && advertiser.logo)
  };
  delete doc.confirmar_similar;
  delete doc.programacion;
  const saved = await db.patch("eventos", eventId, doc,{newDocument:true});
  const programacion = await replaceProgramacion({ db, cache, advertiserId, eventId, programacion: data.programacion, fallbackCity: doc.ciudad_id, previous: [] });
  await syncEventV2({ db, cache, next: saved, programacion });
  return {
    success: true,
    created: true,
    evento_id: eventId,
    estado_moderacion: "PENDIENTE",
    evento: { ...saved, programacion }
  };
}
async function updateEventV3({ db, cache, advertiserId, payload, level = "VIP" }) {
  const data = payload && typeof payload === "object" ? payload : {}, eventId = text30(data.evento_id);
  if (!eventId) throw new Error("Falta evento_id.");
  const current = await db.get("eventos", eventId);
  const wanted = level === "FREE" ? isFree(current) : isVip(current);
  if (!current || text30(current.anunciante_id || current.id_anunciante) !== text30(advertiserId) || !wanted) throw new Error("El evento no pertenece al anunciante.");
  const next = { ...current };
  for (const [k, v] of Object.entries(data)) if (!["evento_id", "programacion"].includes(k)) next[k] = v;
  const hasDataChanges = Object.keys(changedFieldsV1(current, next)).length > 0;
  next.evento_id = eventId;
  next.anunciante_id = advertiserId;
  next.id_anunciante = advertiserId;
  next.nivel = level;
  next.estado_moderacion = "PENDIENTE";
  next.estado = "PENDIENTE";
  next.actualizado = (/* @__PURE__ */ new Date()).toISOString();
  const hasProgramacion = Object.prototype.hasOwnProperty.call(data, "programacion");
  const locationChanged = ["ciudad_id", "sede_id", "lugar_id", "tipo_lugar", "lugar_texto", "lugar", "direccion", "maps", "url_virtual", "link_virtual", "enlace_virtual", "web"].some((k) => Object.prototype.hasOwnProperty.call(data, k) && !sameValueV1(data[k], current[k]));
  const previousProgramacion = hasProgramacion ? await db.queryEqual("evento_programacion", "evento_id", eventId, 500) : await getPreparedRelationsV1({ cache, type: "event", id: eventId, current, load: () => db.queryEqual("evento_programacion", "evento_id", eventId, 500) });
  const validation = { ...next, programacion: Object.prototype.hasOwnProperty.call(data, "programacion") ? data.programacion : previousProgramacion };
  await validateEvent({ db, cache, advertiserId, data: validation, validateLocations: hasProgramacion || locationChanged, previousProgramacion });
  if (!hasDataChanges && !hasProgramacion) return {
    success: true,
    updated: false,
    evento_id: eventId,
    estado_moderacion: current.estado_moderacion,
    evento: { ...current, programacion: previousProgramacion }
  };
  let programacion = validation.programacion;
  if (Object.prototype.hasOwnProperty.call(data, "programacion")) {
    programacion = await replaceProgramacion({ db, cache, advertiserId, eventId, programacion: data.programacion, fallbackCity: next.ciudad_id, previous: previousProgramacion });
  }
  if (!hasDataChanges && !programacion.changed) return {
    success: true,
    updated: false,
    evento_id: eventId,
    estado_moderacion: current.estado_moderacion,
    evento: { ...current, programacion }
  };
  const fields = [...Object.keys(data).filter((k) => !["evento_id", "anunciante_id", "id_anunciante", "nivel", "programacion", "id"].includes(k)), "estado_moderacion", "estado"];
  const patch = changedFieldsV1(current, next, { touch: !!programacion.changed, fields });
  const saved = Object.keys(patch).length ? await db.patch("eventos", eventId, patch, { mustExist: true }) : current;
  await syncEventV2({ db, cache, current, next: saved, previousProgramacion, programacion });
  return {
    success: true,
    updated: true,
    evento_id: eventId,
    estado_moderacion: "PENDIENTE",
    evento: { ...saved, programacion: Array.isArray(programacion) ? programacion : [] }
  };
}
async function pauseEventV3({ db, cache, advertiserId, payload, max, level = "VIP" }) {
  const eventId = text30(payload && payload.evento_id);
  if (!eventId) throw new Error("Falta evento_id.");
  const current = await db.get("eventos", eventId);
  const wanted = level === "FREE" ? isFree(current) : isVip(current);
  if (!current || text30(current.anunciante_id || current.id_anunciante) !== text30(advertiserId) || !wanted) throw new Error("El evento no pertenece al anunciante.");
  const pause = bool12(payload && (payload.pause !== void 0 ? payload.pause : payload.pausado));
  if (!pause && bool12(current.pausado)) {
    const q = await quota2({ db, advertiserId, max: typeof max === "function" ? await max() : max, free: level === "FREE", exclude: eventId });
    if (q.active >= q.max) throw new Error("Alcanzaste el máximo de eventos activos.");
  }
  const patch = changedFieldsV1(current, { pausado: pause, actualizado: (/* @__PURE__ */ new Date()).toISOString() });
  if (!Object.keys(patch).length) return { success: true, updated: false, evento_id: eventId, evento: current };
  const saved = await db.patch("eventos", eventId, patch, { mustExist: true });
  await syncEventV2({ db, cache, current, next: saved });
  return { success: true, evento_id: eventId, evento: saved };
}
async function deleteEventV3({ db, cache, advertiserId, payload, level = "VIP" }) {
  const eventId = text30(payload && payload.evento_id);
  if (!eventId) throw new Error("Falta evento_id.");
  const current = await db.get("eventos", eventId);
  const wanted = level === "FREE" ? isFree(current) : isVip(current);
  if (!current || text30(current.anunciante_id || current.id_anunciante) !== text30(advertiserId) || !wanted) throw new Error("El evento no pertenece al anunciante.");
  const programas = await db.queryEqual("evento_programacion", "evento_id", eventId, 500);
  for (const p of programas) {
    const pid = text30(p.evento_programacion_id || p.id);
    if (pid) await db.delete("evento_programacion", pid);
  }
  await db.delete("eventos", eventId, { mustExist: true });
  await syncEventV2({ db, cache, current, next: null, previousProgramacion: programas });
  return { success: true, deleted: true, evento_id: eventId };
}
async function duplicateVipV3({ db, cache, advertiserId, payload, max, advertiser }) {
  const sourceId = text30(payload && (payload.evento_id || payload.source_id));
  if (!sourceId) throw new Error("Falta evento_id.");
  const source = await db.get("eventos", sourceId);
  if (!source || text30(source.anunciante_id || source.id_anunciante) !== text30(advertiserId) || !isVip(source)) throw new Error("El evento no pertenece al anunciante.");
  const programacion = await db.queryEqual("evento_programacion", "evento_id", sourceId, 500);
  const copy = { ...source, programacion, nombre_evento: text30(payload.nombre_evento || text30(source.nombre_evento) + " - copia") };
  for (const k of ["evento_id", "id", "fecha_carga", "actualizado", "estado_moderacion", "estado", "moderado_por", "moderado_en"]) delete copy[k];
  return createEventV3({ db, cache, advertiserId, payload: copy, max, advertiser, level: "VIP" });
}

// reconstruccion/worker/modules/actividades.js
async function actividadesPanelData({ db, advertiserId, categorias, lugares, featureAllowed, cupoMax }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !featureAllowed(admin)) return { success: false, message: "No tenés habilitado el módulo Actividades." };
  const [actividades, sedes] = await Promise.all([
    db.queryEqual("actividades", "anunciante_id", advertiserId,500),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId,500)
  ]);
  const conHorarios = await Promise.all(actividades.map(async (a) => ({
    ...a,
    horarios: await db.queryEqual("actividad_horarios", "actividad_id", String(a.actividad_id || a.id || ""),500)
  })));
  const max = Number(cupoMax(admin) || 0);
  const activas = conHorarios.filter((a) => a.activo !== false && String(a.estado || "").toUpperCase() !== "PAUSADA").length;
  return {
    success: true,
    permisos: { actividades: true, actividades_cant: max },
    cupo: { max, activas, total: conHorarios.length, totalMax: limiteGuardadasV62(admin,"ACTIVIDADES",max) },
    lugares: lugares || [],
    sedes,
    categorias: categorias || [],
    actividades: conHorarios
  };
}

// reconstruccion/worker/modules/actividades-v2.js
var text31 = (v) => String(v ?? "").trim();
var bool13 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text31(v).toLowerCase());
function today() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1e3);
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}
function id2(prefix) {
  return prefix + "-" + crypto.randomUUID();
}
function quota3(admin) {
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config.ACTIVIDADES || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin.actividades_cant]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
function enabled(admin) {
  if (bool13(admin && admin.actividades)) return true;
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text31(admin && admin.funcionalidades).split(/[;,|\n]/);
  return raw.map((x) => text31(x).toUpperCase()).includes("ACTIVIDADES");
}
async function validateSchedule({ db, cache, advertiserId, h }) {
  const city = text31(h && h.ciudad_id);
  if (!city) throw new Error("Cada horario necesita ciudad.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || (territory.ciudades || []).every((c) => text31(c.ciudad_id || c.id) !== city)) throw new Error("Hay un horario con ciudad inexistente.");
  const type = text31(h.tipo_lugar).toUpperCase();
  const virtual = type.includes("VIRTUAL") || type.includes("ONLINE");
  if (virtual) {
    if (!text31(h.url_virtual || h.link_virtual || h.enlace_virtual || h.web || h.maps)) throw new Error("La actividad virtual necesita enlace o plataforma.");
    return;
  }
  if (text31(h.sede_id)) {
    const sede = await db.get("anunciantes_sedes", text31(h.sede_id));
    if (!sede || text31(sede.anunciante_id) !== text31(advertiserId) || text31(sede.ciudad_id) !== city) throw new Error("La sede no corresponde al anunciante/ciudad.");
    return;
  }
  if (!text31(h.lugar_texto) || !text31(h.direccion)) throw new Error("El lugar físico necesita nombre y dirección.");
}
async function activitySaveV2({ db, cache, advertiserId, body }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !enabled(admin)) throw new Error("No tenés habilitado el módulo Actividades.");
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : {};
  const own = await db.queryEqual("actividades", "anunciante_id", advertiserId);
  const max = quota3(admin), totalMax = limiteGuardadasV62(admin,"ACTIVIDADES",max);
  let activityId = text31(payload.actividad_id), current = null;
  if (activityId) {
    current = await db.get("actividades", activityId);
    if (!current || text31(current.anunciante_id) !== text31(advertiserId)) throw new Error("Actividad no encontrada.");
  } else {
    const active4 = own.filter((a) => bool13(a.activo) && text31(a.estado).toUpperCase() !== "PAUSADA").length;
    if (max <= 0) throw new Error("actividades_sin_cupo");
    if (own.length >= totalMax) throw new Error("actividades_maximo_guardadas");
    if (active4 >= max) throw new Error("actividades_cupo_activo_completo");
    activityId = id2("ACT");
  }
  for (const h of Array.isArray(payload.horarios) ? payload.horarios : []) await validateSchedule({ db, cache, advertiserId, h });
  const oldSchedules = activityId ? await db.queryEqual("actividad_horarios", "actividad_id", activityId) : [];
  const oldCities = [...new Set(oldSchedules.map((h) => text31(h.ciudad_id)).filter(Boolean))];
  const hoy = today();
  const doc = {
    ...current || {},
    ...payload,
    actividad_id: activityId,
    anunciante_id: advertiserId,
    aprobado: current ? bool13(current.aprobado) : false,
    activo: current ? bool13(current.activo) : true,
    estado: current ? text31(current.estado || "ACTIVA") : "PENDIENTE",
    vigente_desde: current ? text31(current.vigente_desde || hoy) : hoy,
    vigente_hasta: current ? text31(current.vigente_hasta || addDays(hoy, 30)) : addDays(hoy, 30),
    creado: current ? text31(current.creado || (/* @__PURE__ */ new Date()).toISOString()) : (/* @__PURE__ */ new Date()).toISOString(),
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  };
  delete doc.horarios;
  if (!text31(doc.nombre)) throw new Error("Falta nombre de la actividad.");
  if (!text31(doc.categoria)) throw new Error("Falta categoría.");
  await db.patch("actividades", activityId, doc, { mustExist: !!current, newDocument: !current });
  if (Array.isArray(payload.horarios)) {
    for (const h of oldSchedules) {
      const hid = text31(h.actividad_horario_id || h.id);
      if (hid) await db.delete("actividad_horarios", hid);
    }
    for (const h of payload.horarios) {
      const hid = id2("AH");
      await db.patch("actividad_horarios", hid, {
        ...h,
        actividad_horario_id: hid,
        actividad_id: activityId,
        ciudad_id: text31(h.ciudad_id),
        activo: h.activo === void 0 ? true : bool13(h.activo),
        actualizado: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  await syncActivity({ db, cache, activityId, previousCities: oldCities });
  return { success: true, actividad_id: activityId };
}
async function activityActionV2({ db, cache, advertiserId, action, activityId }) {
  const current = await db.get("actividades", activityId);
  if (!current || text31(current.anunciante_id) !== text31(advertiserId)) throw new Error("Actividad no encontrada.");
  const hs = await db.queryEqual("actividad_horarios", "actividad_id", activityId);
  const cities = [...new Set(hs.map((h) => text31(h.ciudad_id)).filter(Boolean))];
  if (action === "eliminar") {
    for (const h of hs) {
      const hid = text31(h.actividad_horario_id || h.id);
      if (hid) await db.delete("actividad_horarios", hid);
    }
    await db.delete("actividades", activityId, { mustExist: true });
    await syncActivity({ db, cache, activityId, previousCities: cities });
    return { success: true };
  }
  const patch = { actualizado: (/* @__PURE__ */ new Date()).toISOString() };
  if (action === "pausar") {
    patch.activo = false;
    patch.estado = "PAUSADA";
  }
  if (action === "reanudar" || action === "renovar") {
    patch.activo = true;
    patch.estado = "ACTIVA";
    if (action === "renovar") {
      patch.vigente_desde = today();
      patch.vigente_hasta = addDays(today(), 30);
    }
  }
  await db.patch("actividades", activityId, patch, { mustExist: true });
  await syncActivity({ db, cache, activityId, previousCities: cities });
  return { success: true };
}

// reconstruccion/worker/modules/publicidad.js
async function publicidadPanelData({ db, advertiserId, catalogs, featureEnabled: featureEnabled3, configFromAdmin: configFromAdmin2, cambiosHoy, enrichMany }) {
  const [admin, publicidades] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.queryEqual("publicidades", "anunciante_id", advertiserId)
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  if (!featureEnabled3(admin)) return { success: false, message: "El anunciante no tiene PUBLICIDAD habilitada." };
  const config = configFromAdmin2(admin);
  if (enrichMany) await enrichMany(publicidades);
  const activas = publicidades.filter((p) => String(p.estado || "").toUpperCase() === "ACTIVA").length;
  return {
    success: true,
    config,
    cupo: { activas, activas_max: config.activas_max, guardadas: publicidades.length, guardadas_max: config.guardadas_max },
    cambios_activos: await cambiosHoy(advertiserId, config),
    categorias: catalogs.categorias || [],
    ubicaciones: catalogs.ubicaciones || [],
    prioridades: catalogs.prioridades || [],
    publicidades
  };
}

// reconstruccion/worker/modules/publicidad-v2.js
var {publicityPublicV2,publicitySaveV2,publicityDeleteV2} = (() => {
const text=v=>String(v??"").trim();

async function publicityPublicV2({cache,cityId}){return getPublicityCity({cache,cityId});}

function parseCategoriaKey(value){
  const raw=text(value);
  const idx=raw.indexOf(":");
  if(idx>0){
    return {
      categoria_key:raw,
      ubicacion_id:raw.slice(0,idx),
      categoria_id:raw.slice(idx+1)
    };
  }
  return {categoria_key:raw,ubicacion_id:"",categoria_id:raw};
}

async function publicitySaveV2({db,cache,advertiserId,body,config={prioridad_id:undefined}}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:{};
  const id=text(data.publicidad_id)||("PUB-"+crypto.randomUUID());
  const current=text(data.publicidad_id)?await db.get("publicidades",id):null;
  if(current&&text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");

  const previousSeg=current?await db.queryEqual("publicidad_segmentacion","publicidad_id",id):[];
  const previousCities=[...new Set(previousSeg.map(x=>text(x.ciudad_id)).filter(Boolean))];

  const now=new Date().toISOString();
  const doc={
    ...(current||{}),
    publicidad_id:id,
    anunciante_id:advertiserId,
    nombre_interno:text(data.nombre_interno??current?.nombre_interno),
    titulo:text(data.titulo??current?.titulo),
    formato:text(data.formato??current?.formato).toUpperCase(),
    cta_texto:text(data.cta_texto??current?.cta_texto),
    cta_tipo:text(data.cta_tipo??current?.cta_tipo).toUpperCase(),
    cta_destino:text(data.cta_destino??current?.cta_destino),
    aprobado:current?current.aprobado:true,
    estado:current?text(current.estado):"INACTIVA",
    vigente_desde:current?text(current.vigente_desde):"",
    vigente_hasta:current?text(current.vigente_hasta):"",
    creado:current?text(current.creado):now,
    actualizado:now
  };
  if(!doc.titulo)throw new Error("Falta título de publicidad.");
  await db.patch("publicidades",id,doc,{mustExist:!!current,newDocument:!current});

  if(Array.isArray(data.media)){
    const old=await db.queryEqual("publicidad_media","publicidad_id",id);
    for(const x of old){
      const xid=text(x.media_id||x.id);
      if(xid)await db.delete("publicidad_media",xid);
    }
    let orden=0;
    for(const m of data.media.filter(x=>text(x&&x.url))){
      orden++;
      const mid="MED-"+crypto.randomUUID();
      await db.patch("publicidad_media",mid,{
        media_id:mid,
        publicidad_id:id,
        tipo_media:text(data.formato||doc.formato).toUpperCase(),
        url:text(m.url),
        poster:text(m.poster),
        orden,
        activo:true,
        actualizado:now
      },{newDocument:true});
    }
  }

  if(Array.isArray(data.ciudades)||Array.isArray(data.categorias)){
    const old=await db.queryEqual("publicidad_segmentacion","publicidad_id",id);
    for(const x of old){
      const xid=text(x.segmentacion_id||x.id);
      if(xid)await db.delete("publicidad_segmentacion",xid);
    }

    const cities=Array.isArray(data.ciudades)?[...new Set(data.ciudades.map(text).filter(Boolean))]:[];
    const cats=Array.isArray(data.categorias)?[...new Set(data.categorias.map(text).filter(Boolean))]:[];

    for(const city of cities){
      for(const raw of cats){
        const cat=parseCategoriaKey(raw);
        if(!cat.ubicacion_id||!cat.categoria_id)continue;

        const sid="SEG-"+crypto.randomUUID();
        await db.patch("publicidad_segmentacion",sid,{
          segmentacion_id:sid,
          publicidad_id:id,
          ciudad_id:city,
          ubicacion_id:cat.ubicacion_id,
          categoria_id:cat.categoria_id,
          categoria_key:cat.categoria_key,
          prioridad_id:text(config.prioridad_id).toUpperCase(),
          activo:true,
          creado:now,
          actualizado:now
        },{newDocument:true});
      }
    }
  }

  await syncPublicity({db,cache,publicityId:id,previousCities});
  return{success:true,publicidad_id:id,created:!current,updated:!!current};
}

async function publicityDeleteV2({db,cache,advertiserId,publicityId}){
  const id=text(publicityId);if(!id)throw new Error("Falta publicidad_id.");
  const current=await db.get("publicidades",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  const seg=await db.queryEqual("publicidad_segmentacion","publicidad_id",id);
  const media=await db.queryEqual("publicidad_media","publicidad_id",id);
  const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];
  for(const x of seg){const xid=text(x.segmentacion_id||x.id);if(xid)await db.delete("publicidad_segmentacion",xid);}
  for(const x of media){const xid=text(x.media_id||x.id);if(xid)await db.delete("publicidad_media",xid);}
  await db.delete("publicidades",id,{mustExist:true});
  await syncPublicity({db,cache,publicityId:id,previousCities:cities});
  return{success:true,deleted:true,publicidad_id:id};
}
return {publicityPublicV2,publicitySaveV2,publicityDeleteV2};
})();

// reconstruccion/worker/modules/publicidad-v3.js
var text33 = (v) => String(v ?? "").trim();
function dateKeyArgentina() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1e3);
  return d.toISOString().slice(0, 10);
}
function configFromAdmin(admin) {
  const root = admin && admin.funcionalidades_config && typeof admin.funcionalidades_config === "object" ? admin.funcionalidades_config : {};
  const cfg = root.PUBLICIDAD && typeof root.PUBLICIDAD === "object" ? root.PUBLICIDAD : {};
  const n = (...vals) => {
    for (const v of vals) {
      const x = Number(v);
      if (Number.isFinite(x) && x >= 0) return Math.floor(x);
    }
    return 0;
  };
  return {
    activas_max: n(cfg.activas_max, cfg.activas, cfg.max_activas, admin && admin.publicidad_activas_max),
    guardadas_max: n(cfg.guardadas_max, cfg.guardadas, cfg.max_guardadas, admin && admin.publicidad_guardadas_max),
    cambios_activos_por_dia_max: n(cfg.cambios_activos_por_dia_max, cfg.cambios_diarios, admin && admin.publicidad_cambios_diarios),
    prioridad_id: text33(cfg.prioridad_id || cfg.prioridad || admin && admin.publicidad_prioridad_id)
  };
}
async function publicityActiveChangeV3({ db, cache, advertiserId, ids: ids6 }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin) throw new Error("No existe la administración del anunciante.");
  const cfg = configFromAdmin(admin);
  const selected = [...new Set((Array.isArray(ids6) ? ids6 : []).map(text33).filter(Boolean))];
  if (cfg.activas_max <= 0) throw new Error("sin_cupo_publicidades_activas");
  if (selected.length > cfg.activas_max) throw new Error("supera_publicidades_activas_max");
  const own = await db.queryEqual("publicidades", "anunciante_id", advertiserId, 500);
  const ownIds = new Set(own.map((p) => text33(p.publicidad_id || p.id)).filter(Boolean));
  if (selected.some((id4) => !ownIds.has(id4))) throw new Error("publicidad_no_pertenece_al_anunciante");
  const current = own.filter((p) => text33(p.estado).toUpperCase() === "ACTIVA").map((p) => text33(p.publicidad_id || p.id)).sort();
  const next = [...selected].sort();
  if (JSON.stringify(current) === JSON.stringify(next)) return { success: true, sin_cambios: true };
  const fecha = dateKeyArgentina(), changeId = advertiserId + "_" + fecha;
  const change = await db.get("publicidad_cambios", changeId);
  const usados = Number(change && change.usados || 0);
  if (cfg.cambios_activos_por_dia_max <= 0 || usados >= cfg.cambios_activos_por_dia_max) {
    throw new Error("cambio_activos_diario_agotado");
  }
  const changed = [];
  for (const p of own) {
    const id4 = text33(p.publicidad_id || p.id);
    const should = selected.includes(id4);
    const is = text33(p.estado).toUpperCase() === "ACTIVA";
    if (is === should) continue;
    await db.patch("publicidades", id4, { estado: should ? "ACTIVA" : "INACTIVA", actualizado: (/* @__PURE__ */ new Date()).toISOString() }, { mustExist: true });
    changed.push(id4);
  }
  await db.patch("publicidad_cambios", changeId, {
    cambio_id: changeId,
    anunciante_id: advertiserId,
    fecha,
    usados: usados + 1,
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  });
  for (const id4 of changed) await syncPublicity({ db, cache, publicityId: id4 });
  return { success: true, sin_cambios: false, cambios: changed.length };
}
async function publicityDeleteSafeV3({ db, cache, advertiserId, publicityId }) {
  const id4 = text33(publicityId);
  if (!id4) throw new Error("Falta publicidad_id.");
  const current = await db.get("publicidades", id4);
  if (!current || text33(current.anunciante_id) !== text33(advertiserId)) throw new Error("La publicidad no pertenece al anunciante.");
  if (text33(current.estado).toUpperCase() === "ACTIVA") throw new Error("publicidad_activa_no_eliminable");
  const seg = await db.queryEqual("publicidad_segmentacion", "publicidad_id", id4, 500);
  const media = await db.queryEqual("publicidad_media", "publicidad_id", id4, 500);
  const cities = [...new Set(seg.map((x) => text33(x.ciudad_id)).filter(Boolean))];
  for (const x of seg) {
    const xid = text33(x.segmentacion_id || x.id);
    if (xid) await db.delete("publicidad_segmentacion", xid);
  }
  for (const x of media) {
    const xid = text33(x.media_id || x.id);
    if (xid) await db.delete("publicidad_media", xid);
  }
  await db.delete("publicidades", id4, { mustExist: true });
  await syncPublicity({ db, cache, publicityId: id4, previousCities: cities });
  return { success: true, deleted: true, publicidad_id: id4 };
}

// reconstruccion/worker/modules/efemerides.js
async function efemeridesPanelData({ db, permisos, advertiserId, canSee: canSee3 }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const p = await permisos(advertiserId);
  const jobs = [];
  if (p.efemerides_grl) jobs.push(db.queryEqual("efemerides_bis", "tipo", "GENERAL",500));
  if (p.efemerides_provincial) {
    if (p.todas_provincias) jobs.push(db.queryEqual("efemerides_bis", "tipo", "PROVINCIAL",500));
    else for (const id4 of p.provincias || []) jobs.push(db.queryEqual("efemerides_bis", "provincia_id", id4,500));
  }
  if (p.efemerides_local) {
    if (p.todas_ciudades) jobs.push(db.queryEqual("efemerides_bis", "tipo", "LOCAL",500));
    else for (const id4 of p.ciudades || []) jobs.push(db.queryEqual("efemerides_bis", "ciudad_id", id4,500));
  }
  const groups = await Promise.all(jobs);
  const uniq = /* @__PURE__ */ new Map();
  for (const row of groups.flat()) {
    const id4 = String(row.efemeride_id || row.id || "");
    if (id4) uniq.set(id4, row);
  }
  return { success: true, permisos: p, efemerides: [...uniq.values()].filter((x) => canSee3(x, p)) };
}

// reconstruccion/worker/modules/efemerides-v2.js
var text34 = (v) => String(v ?? "").trim();
var bool14 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text34(v).toLowerCase());
function sanitize(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const out2 = {
    efemeride_id: text34(p.efemeride_id || p.id),
    tipo: text34(p.tipo).toUpperCase(),
    provincia_id: text34(p.provincia_id),
    ciudad_id: text34(p.ciudad_id),
    tipo_fecha: text34(p.tipo_fecha).toUpperCase(),
    nombre: text34(p.nombre),
    descripcion: String(p.descripcion || ""),
    imagen: String(p.imagen || ""),
    activo: p.activo === void 0 ? true : bool14(p.activo),
    origen: text34(p.origen || "WORKER_FIRESTORE")
  };
  if (out2.tipo_fecha === "FIJA") {
    let mes = Number(p.mes || 0), dia = Number(p.dia || 0);
    if ((!mes || !dia) && p.fecha) {
      const m = String(p.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        mes = Number(m[2]);
        dia = Number(m[3]);
      }
    }
    out2.mes = mes;
    out2.dia = dia;
  }
  if (out2.tipo_fecha === "MOVIL") {
    out2.mes = Number(p.mes || 0);
    out2.semana_mes = Number(p.semana_mes || 0);
    out2.dia_semana = text34(p.dia_semana).toUpperCase();
  }
  return out2;
}
function validate(d) {
  if (!d.tipo) return "Falta tipo";
  if (!d.tipo_fecha) return "Falta tipo_fecha";
  if (!d.nombre) return "Falta nombre";
  if (d.tipo === "LOCAL" && !d.ciudad_id) return "Falta ciudad_id";
  if (d.tipo === "PROVINCIAL" && !d.provincia_id) return "Falta provincia_id";
  if (d.tipo_fecha === "FIJA" && (!d.mes || !d.dia)) return "Faltan mes/dia";
  if (d.tipo_fecha === "MOVIL" && (!d.mes || !d.semana_mes || !d.dia_semana)) return "Faltan datos de fecha móvil";
  return "";
}
function canSee(row, p) {
  const tipo = text34(row.tipo).toUpperCase();
  if (tipo === "GENERAL") return !!p.efemerides_grl;
  if (tipo === "PROVINCIAL") return !!p.efemerides_provincial && (p.todas_provincias || p.provincias.includes(text34(row.provincia_id)));
  if (tipo === "LOCAL") return !!p.efemerides_local && (p.todas_ciudades || p.ciudades.includes(text34(row.ciudad_id)));
  return false;
}
async function efemSaveV2({ db, cache, advertiserId, body, permisos }) {
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const reqId = text34(payload.efemeride_id || payload.id);
  const existing = reqId ? await db.get("efemerides_bis", reqId) : null;
  if (reqId && !existing) throw new Error("Efeméride no encontrada");
  const merged = existing ? { ...existing, ...payload, efemeride_id: reqId } : payload;
  const data = sanitize(merged), err = validate(data);
  if (err) throw new Error(err);
  if (!canSee(data, permisos)) throw new Error("No autorizado para esta efeméride");
  const id4 = reqId || data.efemeride_id || "EFE-" + crypto.randomUUID();
  data.efemeride_id = id4;
  data.actualizado_en = (/* @__PURE__ */ new Date()).toISOString();
  if (!existing) {
    data.creado_en = data.actualizado_en;
    data.creado_por = advertiserId;
  } else {
    if (existing.creado_en) data.creado_en = existing.creado_en;
    if (existing.creado_por) data.creado_por = existing.creado_por;
  }
  await db.patch("efemerides_bis", id4, data, { mustExist: !!existing });
  await syncEfemeride({ db, cache, efemerideId: id4, previous: existing });
  return { success: true, efemeride: await db.get("efemerides_bis", id4) };
}
async function efemToggleV2({ db, cache, id: id4, activo, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee(existing, permisos)) throw new Error("No autorizado");
  await db.patch("efemerides_bis", id4, { activo: !!activo, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() }, { mustExist: true });
  await syncEfemeride({ db, cache, efemerideId: id4, previous: existing });
  return { success: true };
}
async function efemDeleteV2({ db, cache, id: id4, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee(existing, permisos)) throw new Error("No autorizado");
  await db.delete("efemerides_bis", id4, { mustExist: true });
  await syncEfemeride({ db, cache, efemerideId: id4, previous: existing });
  return { success: true, deleted: true, efemeride_id: id4 };
}

// reconstruccion/worker/modules/farmacias.js
async function farmaciasPanelData({ db, advertiserId, featureAllowed }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !featureAllowed(admin)) return { success: false, message: "Farmacias de turno no habilitado." };
  const [sedes, ciclos, participantes] = await Promise.all([
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId),
    db.queryEqual("farmacias_ciclos", "anunciante_id", advertiserId),
    db.queryEqual("farmacias_participantes", "anunciante_id", advertiserId)
  ]);
  return { success: true, farmacias: sedes, ciclos, participantes };
}

// reconstruccion/worker/modules/farmacias-v2.js
var text35 = (v) => String(v ?? "").trim();
async function farmSaveCycleV2({ db, cache, advertiserId, body, allowedCityIds = [] }) {
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  let id4 = text35(payload.ciclo_id);
  const current = id4 ? await db.get("farmacias_ciclos", id4) : null;
  if (current && text35(current.anunciante_id) && text35(current.anunciante_id) !== text35(advertiserId)) {
    throw new Error("El ciclo no pertenece al anunciante.");
  }
  const merged = { ...current || {}, ...payload };
  const city = text35(merged.ciudad_id);
  if (!city) throw new Error("Falta ciudad.");
  if (allowedCityIds.length && !allowedCityIds.includes(city)) throw new Error("La ciudad no está habilitada para esta cuenta.");
  if (!text35(merged.fecha_inicio)) throw new Error("Falta fecha de inicio.");
  if (!text35(merged.hora_inicio)) throw new Error("Falta hora de inicio.");
  const dur = Math.max(1, Number(merged.duracion_horas || 24));
  const simult = Math.max(1, Math.floor(Number(merged.farmacias_por_turno || 1)));
  if (!id4) id4 = "FAR-" + crypto.randomUUID();
  let nuevos = null;
  if (Array.isArray(payload.participantes)) {
    nuevos = payload.participantes.map((p, i) => ({
      ciclo_id: id4,
      sede_id: text35(p.sede_id),
      orden: Number(p.orden || i + 1),
      activo: true,
      actualizado: (/* @__PURE__ */ new Date()).toISOString()
    })).filter((p) => p.sede_id);
    if (!nuevos.length) throw new Error("Seleccioná al menos una farmacia.");
    if (simult > nuevos.length) throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");
    for (const p of nuevos) {
      const sede = await db.get("anunciantes_sedes", p.sede_id);
      if (!sede) throw new Error("Hay una farmacia/sede inexistente.");
      if (text35(sede.ciudad_id) !== city) throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
    }
  }
  const previousCity = text35(current && current.ciudad_id);
  await db.patch("farmacias_ciclos", id4, {
    ciclo_id: id4,
    anunciante_id: advertiserId,
    ciudad_id: city,
    fecha_inicio: text35(merged.fecha_inicio),
    hora_inicio: text35(merged.hora_inicio),
    duracion_horas: dur,
    farmacias_por_turno: simult,
    activo: merged.activo === void 0 ? true : !!merged.activo,
    observaciones: text35(merged.observaciones),
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: !!current, newDocument: !current });
  if (nuevos) {
    const existentes = await db.queryEqual("farmacias_ciclo_sedes", "ciclo_id", id4);
    const keep = new Set(nuevos.map((p) => id4 + "__" + p.sede_id));
    for (const r of existentes) {
      const rid = text35(r.id || id4 + "__" + text35(r.sede_id));
      if (rid && !keep.has(rid)) await db.delete("farmacias_ciclo_sedes", rid);
    }
    for (const p of nuevos) await db.patch("farmacias_ciclo_sedes", id4 + "__" + p.sede_id, p);
  }
  await syncFarmCycle({ db, cache, cycleId: id4, previousCity });
  return { success: true, ciclo_id: id4 };
}

// reconstruccion/worker/routes/panel-v3.js
var text36 = (v) => String(v ?? "").trim();
var truthy2 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text36(v).toLowerCase());
async function bodyOf(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf(url, b = {}) {
  return text36(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf(url, b = {}) {
  return text36(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
function featureEnabled(admin, name) {
  const key3 = text36(name).toUpperCase();
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text36(admin && admin.funcionalidades).split(/[;,|\n]/);
  const set = new Set(raw.map((x) => text36(x).toUpperCase()).filter(Boolean));
  return set.has(key3) || truthy2(admin && admin[key3.toLowerCase()]);
}
function cupo(admin, name) {
  const key3 = text36(name).toUpperCase();
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config[key3] || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin[key3.toLowerCase() + "_cant"]]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
async function requirePanel(env, request2, aid, moduleName, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (aid && !sessionAllows(s, aid, moduleName, { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
function efemPermisos(admin){
  const a=admin||{},raw=Array.isArray(a.funcionalidades)?a.funcionalidades:text36(a.funcionalidades).split(/[;,|\n]/);
  const flags=new Set(raw.map(v=>text36(v).toUpperCase()));
  const root=a.funcionalidades_config||{},local=root.EFEMERIDES_LOCAL||{},prov=root.EFEMERIDES_PROVINCIAL||{};
  return {
    efemerides_grl:truthy2(a.efemerides_grl)||flags.has('EF GENERAL')||flags.has('EFEMERIDES_GENERAL')||flags.has('EFEMERIDES_GRL'),
    efemerides_provincial:truthy2(a.efemerides_provincial)||flags.has('EF PROVINCIAL')||flags.has('EFEMERIDES_PROVINCIAL'),
    efemerides_local:truthy2(a.efemerides_local)||flags.has('EF LOCAL')||flags.has('EFEMERIDES_LOCAL'),
    todas_provincias:truthy2(a.efemerides_todas_provincias)||truthy2(prov.todas_provincias),
    todas_ciudades:truthy2(a.efemerides_todas_ciudades)||truthy2(local.todas_ciudades),
    provincias:(Array.isArray(prov.provincias)?prov.provincias:Array.isArray(a.efemerides_provincias)?a.efemerides_provincias:[]).map(text36),
    ciudades:(Array.isArray(local.ciudades)?local.ciudades:Array.isArray(a.efemerides_ciudades)?a.efemerides_ciudades:[]).map(text36)
  };
}

async function routePanelV3({ path, request: request2, url, env, db, cache }) {
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body);
    if (action === "login") return json(await subscriberLogin({ env, db, body }));
    if (action === "session") {
      const out2 = await subscriberSession({ env, request: request2 });
      return json(out2, out2.status || 200);
    }
    return null;
  }
  if (path === "/commerce" && request2.method === "GET") {
    const action = actionOf(url), aid = aidOf(url);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel(env, request2, aid, "modificar_datos");
    if (auth.response) return auth.response;
    if (action === "permisos_panel") {
      const admin = await (db.panelAdministration ? db.panelAdministration(aid) : db.get("anunciantes_administracion", aid));
      return json({ success: !!admin, id: aid, administracion: admin || {} }, admin ? 200 : 404);
    }
    if (action === "anunciante") return json(await commercePanelData({ db, advertiserId: aid, catalogs: await getCommerceCatalogs(cache) }));
    return null;
  }
  if (path === "/commerce" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel(env, request2, aid, "modificar_datos", true);
    if (auth.response) return auth.response;
    if (action === "set_datos") {
      const out2 = await commerceSetDatos({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid });
      return json(out2);
    }
    if (action === "set_sedes") {
      const old = await db.queryEqual("anunciantes_sedes", "anunciante_id", aid);
      const oldCities = [...new Set(old.map((x) => text36(x.ciudad_id)).filter(Boolean))];
      const out2 = await commerceSetSedes({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid, affectedCityIds: oldCities });
      return json(out2);
    }
    if (action === "set_relaciones_sede") {
      const out2 = await commerceSetRelacionesSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid });
      return json(out2);
    }
    if (action === "delete_sede") {
      const out2 = await commerceDeleteSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiser({ db, cache, advertiserId: aid });
      return json(out2);
    }
    return null;
  }
  if (path === "/promos" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel(env, request2, aid, "promos", !["getpaneldata", "getpromos"].includes(action));
    if (auth.response) return auth.response;
    const cupoFromAdmin = (a) => cupo(a, "PROMOS");
    if (action === "getpaneldata") return json(await promosPanelDataV2({ db, cache, advertiserId: aid, cupoFromAdmin }));
    if (action === "createpromo") return json(await promoCreateV2({ db, cache, advertiserId: aid, body, cupoFromAdmin }));
    if (action === "updatepromo") return json(await promoUpdateV2({ db, cache, advertiserId: aid, body, cupoFromAdmin }));
    if (action === "deletepromo") return json(await promoDeleteV2({ db, cache, advertiserId: aid, body }));
    return null;
  }
  if (path === "/events-new" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const freeAction = action.includes("free");
    const moduleName = freeAction ? "eventos_free" : "eventos";
    const readActions = ["getpaneldata", "paneldata", "bootstrap", "geteventospanel", "getvipevents", "getfreeevents"];
    const auth = await requirePanel(env, request2, aid, moduleName, !readActions.includes(action));
    if (auth.response) return auth.response;
    const admin = await db.get("anunciantes_administracion", aid);
    if (["getpaneldata", "paneldata", "bootstrap", "geteventospanel"].includes(action)) {
      return json(await eventosPanelData({ db, advertiserId: aid, catalogs: await getEventosCatalogs(cache), featureEnabled, cupo, enrichPrograms: null }));
    }
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const advertiser = await db.get("anunciantes", aid);
    if (action === "createvipevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS"), advertiser, level: "VIP" }));
    if (action === "updatevipevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "pausevipevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS"), level: "VIP" }));
    if (action === "deletevipevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "duplicatevipevent" || action === "duplicate") return json(await duplicateVipV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS"), advertiser }));
    if (action === "createfreeevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS_FREE"), advertiser, level: "FREE" }));
    if (action === "updatefreeevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    if (action === "pausefreeevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: cupo(admin, "EVENTOS_FREE"), level: "FREE" }));
    if (action === "deletefreeevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    return null;
  }
  if (path === "/actividades" && request2.method === "GET" && actionOf(url) === "getpaneldata") {
    const aid = aidOf(url), auth = await requirePanel(env, request2, aid, "actividades");
    if (auth.response) return auth.response;
    const catalogs = await getActividadesCatalogs(cache);
    return json(await actividadesPanelData({
      db,
      advertiserId: aid,
      categorias: catalogs.categorias,
      lugares: catalogs.lugares,
      featureAllowed: (a) => featureEnabled(a, "ACTIVIDADES"),
      cupoMax: (a) => cupo(a, "ACTIVIDADES")
    }));
  }
  if (path === "/actividades" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "actividades", true);
    if (auth.response) return auth.response;
    if (action === "guardar") return json(await activitySaveV2({ db, cache, advertiserId: aid, body }));
    if (["renovar", "pausar", "reanudar", "eliminar"].includes(action)) {
      return json(await activityActionV2({ db, cache, advertiserId: aid, action, activityId: text36(body.actividad_id) }));
    }
    return null;
  }
  if (path === "/publicidad" && request2.method === "GET" && actionOf(url) === "getpaneldata") {
    const aid = aidOf(url), auth = await requirePanel(env, request2, aid, "publicidad");
    if (auth.response) return auth.response;
    const catalogs = await getPublicidadCatalogs(cache);
    const admin = await db.get("anunciantes_administracion", aid);
    return json(await publicidadPanelData({
      db,
      advertiserId: aid,
      catalogs,
      featureEnabled: (a) => featureEnabled(a, "PUBLICIDAD"),
      configFromAdmin,
      cambiosHoy: async () => {
        const cfg = configFromAdmin(admin || {}), fecha = new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
        const c = await db.get("publicidad_cambios", aid + "_" + fecha);
        const usados = Number(c && c.usados || 0), max = Number(cfg.cambios_activos_por_dia_max || 0);
        return { usados, max, disponibles: max > 0 ? Math.max(0, max - usados) : 0 };
      },
      enrichMany: null
    }));
  }
  if (path === "/publicidad" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "publicidad", true);
    if (auth.response) return auth.response;
    if (action === "guardar") {
      const admin = await db.get("anunciantes_administracion", aid);
      return json(await publicitySaveV2({
        db,
        cache,
        advertiserId: aid,
        body,
        config: configFromAdmin(admin || {})
      }));
    }
    if (action === "actualizar_activos") return json(await publicityActiveChangeV3({ db, cache, advertiserId: aid, ids: body.publicidad_ids }));
    if (action === "eliminar") return json(await publicityDeleteSafeV3({ db, cache, advertiserId: aid, publicityId: text36(body.publicidad_id) }));
    return null;
  }
  if (path === "/efemerides" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "efemerides", action !== "getpaneldata");
    if (auth.response) return auth.response;
    const readAction=["getpaneldata","paneldata","bootstrap","listar","listar_admin","list"].includes(action);
    const readDb=readAction&&db.panelReadDb?db.panelReadDb():db;
    const admin = await readDb.get("anunciantes_administracion", aid), permisos = efemPermisos(admin || {});
    if (["getpaneldata", "paneldata", "bootstrap", "listar", "listar_admin", "list"].includes(action)) {
      return json(await efemeridesPanelData({ db, permisos: async () => permisos, advertiserId: aid, canSee: () => true }));
    }
    if (action === "guardar" || action === "save") return json(await efemSaveV2({ db, cache, advertiserId: aid, body, permisos }));
    if (action === "activar" || action === "desactivar") {
      const id4 = text36(body.efemeride_id || body.id || body.payload && (body.payload.efemeride_id || body.payload.id));
      return json(await efemToggleV2({ db, cache, id: id4, activo: action === "activar", permisos }));
    }
    if (action === "eliminar" || action === "delete") {
      const id4 = text36(body.efemeride_id || body.id || body.payload && (body.payload.efemeride_id || body.payload.id));
      return json(await efemDeleteV2({ db, cache, id: id4, permisos }));
    }
    return null;
  }
  if (path === "/farmacias" && request2.method === "POST") {
    const body = await bodyOf(request2), action = actionOf(url, body), aid = aidOf(url, body);
    const auth = await requirePanel(env, request2, aid, "turnos_farma", action !== "getpaneldata");
    if (auth.response) return auth.response;
    if (action === "getpaneldata") {
      return json(await farmaciasPanelData({ db, advertiserId: aid, featureAllowed: (a) => featureEnabled(a, "TURNOS_FARMA") || truthy2(a && a.turnos_farma) }));
    }
    if (action === "guardar_ciclo") {
      const admin = await db.get("anunciantes_administracion", aid);
      const territory = await cache.get("territorio:public:v1") || {};
      const allowed = Array.isArray(admin && admin.farmacias_ciudades) && admin.farmacias_ciudades.length ? admin.farmacias_ciudades.map(text36) : (territory.ciudades || []).map((c) => text36(c.ciudad_id || c.id)).filter(Boolean);
      return json(await farmSaveCycleV2({ db, cache, advertiserId: aid, body, allowedCityIds: allowed }));
    }
    return null;
  }
  return null;
}

// reconstruccion/worker/modules/eventos-panel-v2.js
var text37 = (v) => String(v ?? "").trim();
var norm5 = (v) => text37(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
var isFree2 = (e) => text37(e && e.nivel).toUpperCase() === "FREE";
async function eventsPanelDataV2({ db, cache, advertiserId, featureEnabled: featureEnabled3, cupo: cupo3 }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin, advertiser, events, sedes, catalogs] = await Promise.all([
    db.get("anunciantes_administracion", advertiserId),
    db.get("anunciantes", advertiserId),
    db.queryEqual("eventos", "anunciante_id", advertiserId, 500),
    db.queryEqual("anunciantes_sedes", "anunciante_id", advertiserId, 500),
    cache.get("catalogs:eventos:v1")
  ]);
  if (!admin) return { success: false, message: "No existe la administración del anunciante." };
  const enriched = await Promise.all(events.map(async (e) => ({
    ...e,
    programacion: await db.queryEqual("evento_programacion", "evento_id", text37(e.evento_id || e.id), 500)
  })));
  return {
    success: true,
    advertiser: advertiser || { id: advertiserId },
    funcionalidades: {
      eventos: !!featureEnabled3(admin, "EVENTOS"),
      eventos_free: !!featureEnabled3(admin, "EVENTOS_FREE")
    },
    eventos_cant: Number(cupo3(admin, "EVENTOS") || 0),
    eventos_free_cant: Number(cupo3(admin, "EVENTOS_FREE") || 0),
    eventos_guardadas_max:limiteGuardadasV62(admin,"EVENTOS",cupo3(admin,"EVENTOS")),
    eventos_free_guardadas_max:limiteGuardadasV62(admin,"EVENTOS_FREE",cupo3(admin,"EVENTOS_FREE")),
    categorias: catalogs && catalogs.categorias || [],
    lugares: [...catalogs && catalogs.lugares || [], ...sedes],
    partners: catalogs && catalogs.partners || [],
    eventos: enriched.filter((e) => !isFree2(e)),
    eventos_free: enriched.filter(isFree2)
  };
}
async function checkFreeDuplicatesV2({ db, payload }) {
  const data = payload && typeof payload === "object" ? payload : {};
  const city = text37(data.ciudad_id);
  if (!city) return [];
  const rows = await db.queryEqual("eventos", "ciudad_id", city, 500);
  const wantedName = norm5(data.nombre_evento);
  const wantedPlace = norm5(data.lugar || data.lugar_texto);
  const wantedDate = text37(data.fecha_desde);
  return rows.filter(isFree2).filter((e) => {
    const sameDate = wantedDate && text37(e.fecha_desde) === wantedDate;
    const sameName = wantedName && norm5(e.nombre_evento) === wantedName;
    const samePlace = wantedPlace && norm5(e.lugar || e.lugar_texto) === wantedPlace;
    return sameDate && (sameName || samePlace);
  }).slice(0, 5);
}

// reconstruccion/worker/modules/publicidad-panel-v2.js
var {publicidadPanelDataV2} = (() => {
/**
 * PUBLICIDAD PANEL V2
 * Catálogos desde KV. Hijos sólo de las publicidades del anunciante.
 */
const text=v=>String(v??"").trim();

async function publicidadPanelDataV2({db,cache,advertiserId,featureEnabled,configFromAdmin}){
  if(db.panelReadDb)db=db.panelReadDb();
  const [admin,docs,catalogs]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("publicidades","anunciante_id",advertiserId,500),
    cache.get("catalogs:publicidad:v1")
  ]);
  if(!admin)return{success:false,message:"No existe la administración del anunciante."};
  if(!featureEnabled(admin))return{success:false,message:"El anunciante no tiene PUBLICIDAD habilitada."};

  const publicidades=await Promise.all(docs.map(async p=>{
    const id=text(p.publicidad_id||p.id);
    const [media,segmentacion]=await Promise.all([
      db.queryEqual("publicidad_media","publicidad_id",id,500),
      db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)
    ]);
    return{...p,media,segmentacion};
  }));

  const config=configFromAdmin(admin);
  const fecha=new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
  const cambioId=advertiserId+"_"+fecha;
  const cambios=await db.get("publicidad_cambios",cambioId);
  const usados=Number(cambios&&cambios.usados||0);
  const max=Number(config.cambios_activos_por_dia_max||0);
  const activas=publicidades.filter(p=>text(p.estado).toUpperCase()==="ACTIVA").length;

  return{
    success:true,
    config,
    cupo:{
      activas,
      activas_max:Number(config.activas_max||0),
      guardadas:publicidades.length,
      guardadas_max:Number(config.guardadas_max||0)
    },
    cambios_activos:{
      usados,max,
      disponibles:max>0?Math.max(0,max-usados):0
    },
    categorias:(catalogs&&catalogs.categorias)||[],
    ubicaciones:(catalogs&&catalogs.ubicaciones)||[],
    prioridades:(catalogs&&catalogs.prioridades)||[],
    publicidades
  };
}
return {publicidadPanelDataV2};
})();

// reconstruccion/worker/modules/farmacias-panel-v3.js
var {farmaciasPanelDataV3} = (() => {
/**
 * FARMACIAS PANEL V3
 * Sin scans globales: ciclos se consultan por anunciante_id.
 */
const text=v=>String(v??"").trim();
const active=v=>!text(v)||["activa","activo","true","1","x"].includes(text(v).toLowerCase());
// Selección territorial desde la guía preparada: el administrador de turnos
// no es necesariamente propietario de las farmacias que participan.
async function pharmacyCatalog(cache,cityIds,cycles){
  const catalogs=(await cache.get("catalogs:commerce:v1"))||{};
  const pharmacyIds=new Set((catalogs.categorias||[]).filter(c=>
    [c.nombre,c.titulo,c.categoria].some(v=>text(v).toLowerCase().includes("farmacia"))
  ).map(c=>text(c.categoria_id||c.id)));
  const participantIds=new Set(cycles.flatMap(c=>(c.participantes||[]).map(p=>text(p.sede_id))));
  const result=new Map();
  await Promise.all(cityIds.map(async city=>{
    const packet=await cache.get("guide:city:v1:"+city);
    for(const card of packet?.anunciantes||[]){
      const categories=Array.isArray(card.categoria_ids)?card.categoria_ids:text(card.categoria_ids||card.categoria_id).split(/[;,|]+/);
      const byCategory=categories.some(id=>pharmacyIds.has(text(id)))||(card.categorias||[]).some(v=>text(v).toLowerCase().includes("farmacia"));
      for(const sede of card.sedes||[]){
        const id=text(sede.sede_id||sede.id);
        if(!id||text(sede.ciudad_id||card.ciudad_id)!==city||!active(sede.estado))continue;
        const byName=[card.nombre,sede.nombre_ref,sede.nombre_sede,sede.nombre].some(v=>text(v).toLowerCase().includes("farmacia"));
        if(!byName&&!byCategory&&!participantIds.has(id))continue;
        // Sólo información de contacto preparada para la vista pública.
        const row={...sede,sede_id:id,anunciante_id:text(card.id||card.anunciante_id),ciudad_id:city,nombre_ref:text(card.nombre||sede.nombre_ref),nombre_sede:text(sede.nombre_sede),estado:"ACTIVA"};
        for(const key of ["telefono","telefono2","telefono3","telefono4","telefono5","whatsapp","whatsapp2","whatsapp3","whatsapp4","whatsapp5","mail","instagram","facebook","logo"])row[key]=text(sede[key]||card[key]);
        result.set(id,row);
      }
    }
  }));
  return [...result.values()].sort((a,b)=>text(a.nombre_ref||a.nombre_sede).localeCompare(text(b.nombre_ref||b.nombre_sede),"es"));
}

async function farmaciasPanelDataV3({db,cache,advertiserId,featureAllowed,allowedCityIds=[]}){
  if(db.panelReadDb)db=db.panelReadDb();
  const admin=await db.get("anunciantes_administracion",advertiserId);
  if(!admin||!featureAllowed(admin))return{success:false,message:"Farmacias de turno no habilitado."};

  const [ciclos,territorio]=await Promise.all([
    db.queryEqual("farmacias_ciclos","anunciante_id",advertiserId,500),
    cache.get("territorio:public:v1")
  ]);

  const cicloData=await Promise.all(ciclos.map(async c=>{
    const id=text(c.ciclo_id||c.id);
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    return{...c,participantes};
  }));

  const ciudades=allowedCityIds.length
    ? ((territorio&&territorio.ciudades)||[]).filter(c=>allowedCityIds.includes(text(c.ciudad_id||c.id)))
    : ((territorio&&territorio.ciudades)||[]);

  const farmacias=await pharmacyCatalog(cache,ciudades.map(c=>text(c.ciudad_id||c.id)).filter(Boolean),cicloData);
  return{
    success:true,
    farmacias,
    ciclos:cicloData,
    participantes:cicloData.flatMap(c=>Array.isArray(c.participantes)?c.participantes:[]),
    ciudades
  };
}

return {farmaciasPanelDataV3};
})();

// reconstruccion/worker/routes/panel-v4.js
var text40 = (v) => String(v ?? "").trim();
var truthy3 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text40(v).toLowerCase());
async function bodyOf2(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf2(url, b = {}) {
  return text40(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf2(url, b = {}) {
  return text40(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
function farmFeatureEnabled(admin){
  // Mismos nombres históricos que habilitan la pestaña del panel.
  const normalize=v=>String(v??"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  const aliases=new Set(["TURNOSFARMA","FARMACIA","FARMACIAS","FARMACIASTURNO","FARMACIASDETURNO"]);
  const raw=Array.isArray(admin&&admin.funcionalidades)?admin.funcionalidades:String(admin?.funcionalidades??"").trim().split(/[;,|\n]/);
  if(raw.some(v=>aliases.has(normalize(v))))return true;
  return Object.entries(admin||{}).some(([key,value])=>aliases.has(normalize(key))&&(value===true||value===1||["true","1","si","sí","x","activo","activa"].includes(String(value??"").trim().toLowerCase())));
}
function featureEnabled2(admin, name) {
  const key3 = text40(name).toUpperCase();
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text40(admin && admin.funcionalidades).split(/[;,|\n]/);
  const set = new Set(raw.map((x) => text40(x).toUpperCase()).filter(Boolean));
  return set.has(key3) || truthy3(admin && admin[key3.toLowerCase()]);
}
function cupo2(admin, name) {
  const key3 = text40(name).toUpperCase();
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config[key3] || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin[key3.toLowerCase() + "_cant"]]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
async function requirePanel2(env, request2, aid, moduleName, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (aid && !sessionAllows(s, aid, moduleName, { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
async function allowedFarmCities({ db, cache, aid }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const admin = await db.get("anunciantes_administracion", aid);
  const territory = await cache.get("territorio:public:v1") || {};
  const cfgRoot = admin && admin.funcionalidades_config && typeof admin.funcionalidades_config === "object" ? admin.funcionalidades_config : {};
  const cfg = cfgRoot.TURNOS_FARMA || cfgRoot.FARMACIAS || cfgRoot.turnos_farma || {};
  const all = truthy3(cfg.todas_ciudades) || text40(admin && admin.turnos_farma) === "*";
  const ids6 = Array.isArray(cfg.ciudades) ? cfg.ciudades.map(text40).filter(Boolean) : text40(admin && admin.turnos_farma).split(/[;,|]+/).map(text40).filter((v) => v && v !== "*");
  if (all || !ids6.length) {
    return (territory.ciudades || []).map((c) => text40(c.ciudad_id || c.id)).filter(Boolean);
  }
  return [...new Set(ids6)];
}
async function routePanelV4(ctx) {
  const { path, request: request2, url, env, cache } = ctx;
  let db = ctx.db;
  if (path === "/events-new" && request2.method === "POST") {
    const body = await bodyOf2(request2), action = actionOf2(url, body), aid = aidOf2(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const freeAction = action.includes("free");
    const moduleName = freeAction ? "eventos_free" : "eventos";
    const readActions = ["getpaneldata", "paneldata", "bootstrap", "geteventospanel", "getfreeeventspaneldata", "getvipevents", "getfreeevents", "checkfreeeventduplicates"];
    const auth = await requirePanel2(env, request2, aid, moduleName, !readActions.includes(action));
    if (auth.response) return auth.response;
    if (["getpaneldata", "paneldata", "bootstrap", "geteventospanel", "getfreeeventspaneldata"].includes(action)) {
      return json(await eventsPanelDataV2({ db, cache, advertiserId: aid, featureEnabled: featureEnabled2, cupo: cupo2 }));
    }
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    if (["createfreeevent", "updatefreeevent"].includes(action) && String(payload.descripcion ?? "").length > 200) return json({success:false,error:"descripcion_free_demasiado_larga",message:"La descripción admite hasta 200 caracteres."},400);
    if (action === "getvipevents" || action === "getfreeevents") {
      const panel = await eventsPanelDataV2({ db, cache, advertiserId: aid, featureEnabled: featureEnabled2, cupo: cupo2 });
      const rows = action === "getfreeevents" ? panel.eventos_free : panel.eventos;
      return json({ success: true, events: rows, eventos: rows, rows });
    }
    if (action === "checkfreeeventduplicates") {
      return json({ success: true, duplicados: await checkFreeDuplicatesV2({ db, payload }) });
    }
    if (db.panelReadDb) { const reads = db.panelReadDb(); db = {...db, get: reads.get, queryEqual: reads.queryEqual}; }
    const creates = ["createvipevent", "createfreeevent", "duplicatevipevent", "duplicate"].includes(action);
    const admin = creates ? await db.get("anunciantes_administracion", aid) : null;
    const advertiser = creates ? await db.get("anunciantes", aid) : null;
    if (action === "createvipevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo2(admin, "EVENTOS"), advertiser, level: "VIP" }));
    if (action === "updatevipevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "pausevipevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: async () => cupo2(await db.get("anunciantes_administracion", aid), "EVENTOS"), level: "VIP" }));
    if (action === "deletevipevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "VIP" }));
    if (action === "duplicatevipevent" || action === "duplicate") return json(await duplicateVipV3({ db, cache, advertiserId: aid, payload, max: cupo2(admin, "EVENTOS"), advertiser }));
    if (action === "createfreeevent") return json(await createEventV3({ db, cache, advertiserId: aid, payload, max: cupo2(admin, "EVENTOS_FREE"), advertiser, level: "FREE" }));
    if (action === "updatefreeevent") return json(await updateEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    if (action === "pausefreeevent") return json(await pauseEventV3({ db, cache, advertiserId: aid, payload, max: async () => cupo2(await db.get("anunciantes_administracion", aid), "EVENTOS_FREE"), level: "FREE" }));
    if (action === "deletefreeevent") return json(await deleteEventV3({ db, cache, advertiserId: aid, payload, level: "FREE" }));
    return null;
  }
  if (path === "/publicidad" && request2.method === "GET" && actionOf2(url) === "getpaneldata") {
    const aid = aidOf2(url);
    const auth = await requirePanel2(env, request2, aid, "publicidad");
    if (auth.response) return auth.response;
    return json(await publicidadPanelDataV2({
      db,
      cache,
      advertiserId: aid,
      featureEnabled: (a) => featureEnabled2(a, "PUBLICIDAD"),
      configFromAdmin
    }));
  }
  if (path === "/publicidad" && request2.method === "POST") {
    const body = await bodyOf2(request2), action = actionOf2(url, body), aid = aidOf2(url, body);
    const auth = await requirePanel2(env, request2, aid, "publicidad", true);
    if (auth.response) return auth.response;
    if (action === "guardar") return json(await publicitySaveV2({ db, cache, advertiserId: aid, body }));
    if (action === "actualizar_activos") return json(await publicityActiveChangeV3({ db, cache, advertiserId: aid, ids: body.publicidad_ids }));
    if (action === "eliminar") return json(await publicityDeleteSafeV3({ db, cache, advertiserId: aid, publicityId: text40(body.publicidad_id) }));
    return null;
  }
  if (path === "/farmacias" && request2.method === "POST") {
    const body = await bodyOf2(request2), action = actionOf2(url, body), aid = aidOf2(url, body);
    const auth = await requirePanel2(env, request2, aid, "turnos_farma", action !== "getpaneldata");
    if (auth.response) return auth.response;
    const allowed = await allowedFarmCities({ db, cache, aid });
    if (action === "getpaneldata") {
      return json(await farmaciasPanelDataV3({
        db,
        cache,
        advertiserId: aid,
        featureAllowed: farmFeatureEnabled,
        allowedCityIds: allowed
      }));
    }
    if (action === "guardar_ciclo") {
      return json(await farmSaveCycleV2({ db, cache, advertiserId: aid, body, allowedCityIds: allowed }));
    }
    return null;
  }
  return routePanelV3(ctx);
}

// reconstruccion/worker/core/guide-read-model-v2.js
var text41 = (v) => String(v ?? "").trim();
var bool15 = (v) => {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "aprobado", "activo", "activa"].includes(text41(v).toLowerCase());
};
var ids3 = (v) => Array.isArray(v) ? v.map(text41).filter(Boolean) : text41(v).split(/[;,|\n]/).map(text41).filter(Boolean);
var guideCityKey2 = (cityId) => "guide:city:v1:" + text41(cityId);
var guideAdvertiserKey = (aid) => "guide:advertiser:v2:" + text41(aid);
function mapBy2(rows, field) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const id4 = text41(r && r[field] || r && r.id);
    if (id4) m.set(id4, r);
  }
  return m;
}
function relObjects2(values, map, idField) {
  return ids3(values).map((id4) => {
    const x = map.get(id4) || {};
    return { [idField]: id4, nombre: text41(x.nombre), insignia: text41(x.insignia) };
  });
}
function sortCards2(rows) {
  return [...rows].sort((a, b) => text41(a.nombre).localeCompare(text41(b.nombre), "es", { sensitivity: "base" }));
}
function publicAllowed(card) {
  return card && card.aprobado !== false;
}
function upsertCard(rows, card) {
  const aid = text41(card && card.id);
  const out2 = (rows || []).filter((x) => text41(x.id) !== aid);
  if (publicAllowed(card)) out2.push(card);
  return sortCards2(out2);
}
function buildGuideCardBaseV2({ advertiser, admin, sedes, catalogs, territory, cityId }) {
  if (!advertiser) return null;
  const city = text41(cityId);
  const citySedes = (sedes || []).filter((s) => text41(s.ciudad_id) === city);
  if (!city) return null;
  const segMap = mapBy2(catalogs.segmentos, "segmento_id");
  const catMap = mapBy2(catalogs.categorias, "categoria_id");
  const actMap = mapBy2(catalogs.actividades_clave, "actividad_id");
  const actionMap = mapBy2(catalogs.acciones, "accion_id");
  const nodeMap = mapBy2(catalogs.nodos, "nodo_id");
  const segmentoId = text41(advertiser.segmento_id);
  const segmento = segMap.get(segmentoId) || {};
  const categoriaIds = ids3(advertiser.categoria_ids || advertiser.categoria_id);
  const categorias = categoriaIds.map((id4) => catMap.get(id4)).filter(Boolean).map((x) => text41(x.nombre)).filter(Boolean);
  const cityMeta = (territory.ciudades || []).find((x) => text41(x.ciudad_id || x.id) === city) || {};
  return {
    id: text41(advertiser.id || advertiser.anunciante_id),
    nombre: text41(advertiser.nombre),
    aprobado: admin && admin.aprobado !== void 0 ? bool15(admin.aprobado) : true,
    nivel: text41(admin && admin.nivel),
    subnivel: text41(admin && admin.subnivel),
    verificado: bool15(admin && admin.verificado),
    gold: bool15(admin && admin.gold),
    segmento_id: segmentoId,
    segmento: text41(segmento.nombre),
    categoria_ids: categoriaIds,
    categorias,
    actividad: text41(advertiser.actividad),
    descripcion: text41(advertiser.descripcion),
    tags: text41(advertiser.tags),
    adicionales: text41(advertiser.adicionales),
    logo: text41(advertiser.logo),
    img1: text41(advertiser.img1),
    img2: text41(advertiser.img2),
    img3: text41(advertiser.img3),
    img4: text41(advertiser.img4),
    img5: text41(advertiser.img5),
    img6: text41(advertiser.img6),
    img7: text41(advertiser.img7),
    img8: text41(advertiser.img8),
    img9: text41(advertiser.img9),
    img10: text41(advertiser.img10),
    link: text41(advertiser.link),
    ciudad_id: city,
    ciudad: text41(cityMeta.ciudad_visible),
    provincia_id: text41(cityMeta.provincia_id),
    provincia: text41(cityMeta.provincia_visible),
    pais_id: text41(cityMeta.pais_id),
    pais: text41(cityMeta.pais_visible),
    sedes: citySedes.map((s) => ({
      sede_id: text41(s.sede_id || s.id),
      nombre_sede: text41(s.nombre_sede),
      direccion: text41(s.direccion),
      ciudad_id: city,
      ciudad: text41(s.ciudad || cityMeta.ciudad_visible),
      provincia_id: text41(s.provincia_id || cityMeta.provincia_id),
      provincia: text41(s.provincia || cityMeta.provincia_visible),
      pais_id: text41(s.pais_id || cityMeta.pais_id),
      pais: text41(s.pais || cityMeta.pais_visible),
      codigo_postal: text41(s.codigo_postal),
      lat: s.lat ?? "",
      lng: s.lng ?? "",
      maps: text41(s.maps),
      telefono: text41(s.telefono),
      telefono2: text41(s.telefono2),
      telefono3: text41(s.telefono3),
      telefono4: text41(s.telefono4),
      telefono5: text41(s.telefono5),
      whatsapp: text41(s.whatsapp),
      whatsapp2: text41(s.whatsapp2),
      whatsapp3: text41(s.whatsapp3),
      whatsapp4: text41(s.whatsapp4),
      whatsapp5: text41(s.whatsapp5),
      mail: text41(s.mail),
      mail2: text41(s.mail2),
      mail3: text41(s.mail3),
      instagram: text41(s.instagram),
      facebook: text41(s.facebook),
      youtube: text41(s.youtube),
      tiktok: text41(s.tiktok),
      x: text41(s.x),
      linkedin: text41(s.linkedin),
      estado: text41(s.estado),
      actividades: relObjects2(s.actividad_ids, actMap, "actividad_id"),
      acciones: relObjects2(s.accion_ids, actionMap, "accion_id"),
      nodos: relObjects2(s.nodo_ids, nodeMap, "nodo_id"),
      img1: text41(s.img1),
      img2: text41(s.img2),
      img3: text41(s.img3),
      img4: text41(s.img4),
      img5: text41(s.img5),
      img6: text41(s.img6),
      img7: text41(s.img7),
      img8: text41(s.img8),
      img9: text41(s.img9),
      img10: text41(s.img10)
    }))
  };
}
async function syncGuideAdvertiserV2({ db, cache, advertiserId, affectedCityIds = [] }) {
  const aid = text41(advertiserId);
  const [advertiser, admin, sedes, catalogs, territory, previousBase] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1"),
    cache.get(guideAdvertiserKey(aid))
  ]);
  const sedeCities = (sedes || []).map((s) => text41(s.ciudad_id)).filter(Boolean);
  const currentCities = [...new Set(sedeCities.length ? sedeCities : [text41(advertiser?.ciudad_id), ...previousBase?.ciudades || []].filter(Boolean))];
  const previousCities = Array.isArray(previousBase && previousBase.ciudades) ? previousBase.ciudades : [];
  const targets = [...new Set([...(affectedCityIds || []).map(text41), ...previousCities, ...currentCities].filter(Boolean))];
  const cards = [];
  if (advertiser) {
    for (const cityId of currentCities) {
      const card = buildGuideCardBaseV2({
        advertiser,
        admin: admin || {},
        sedes,
        catalogs: catalogs || {},
        territory: territory || {},
        cityId
      });
      if (card) cards.push(card);
    }
  }
  const cardMap = new Map(cards.map((c) => [text41(c.ciudad_id), c]));
  for (const cityId of targets) {
    const key3 = guideCityKey2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    const base2 = cardMap.get(cityId);
    let rows = (packet2.anunciantes || []).filter((x) => text41(x.id) !== aid);
    if (base2 && publicAllowed(base2)) rows.push(base2);
    await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), anunciantes: sortCards2(rows) });
  }
  await cache.put(guideAdvertiserKey(aid), {
    version: 2,
    anunciante_id: aid,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    ciudades: currentCities,
    template: cards[0] || previousBase?.template || previousBase?.cards?.[0],
    cards
  });
  return { success: true, advertiser_id: aid, ciudades_actualizadas: targets };
}
async function patchGuideAdminFieldsV2({ cache, advertiserId, patch }) {
  const aid = text41(advertiserId);
  const allowed = ["aprobado", "nivel", "subnivel", "verificado", "gold"];
  const relevant = {};
  for (const key3 of allowed) if (Object.prototype.hasOwnProperty.call(patch || {}, key3)) relevant[key3] = patch[key3];
  if (!Object.keys(relevant).length) return { success: true, changed: false, firestore_reads: 0 };
  const base2 = await cache.get(guideAdvertiserKey(aid));
  if (!base2 || !Array.isArray(base2.cards)) {
    return { success: true, changed: false, needs_full_sync: true, firestore_reads: 0 };
  }
  const nextCards = base2.cards.map((card) => {
    const out2 = { ...card };
    if ("aprobado" in relevant) out2.aprobado = !!relevant.aprobado;
    if ("nivel" in relevant) out2.nivel = text41(relevant.nivel);
    if ("subnivel" in relevant) out2.subnivel = text41(relevant.subnivel);
    if ("verificado" in relevant) out2.verificado = !!relevant.verificado;
    if ("gold" in relevant) out2.gold = !!relevant.gold;
    return out2;
  });
  for (const card of nextCards) {
    const cityId = text41(card.ciudad_id), key3 = guideCityKey2(cityId);
    const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    await cache.put(key3, {
      version: 2,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      anunciantes: upsertCard(packet2.anunciantes || [], card)
    });
  }
  await cache.put(guideAdvertiserKey(aid), {
    ...base2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    template: nextCards[0] || Object.assign({}, base2.template || {}, relevant),
    cards: nextCards
  });
  return { success: true, changed: true, ciudades: base2.ciudades || [], firestore_reads: 0 };
}
async function rebuildGuideAllV2({ db, cache }) {
  const [advertisers, admins, sedes, catalogs, territory] = await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  const adminMap = new Map(admins.map((a) => [text41(a.id || a.anunciante_id), a]));
  const sedesBy = /* @__PURE__ */ new Map();
  for (const s of sedes) {
    const aid = text41(s.anunciante_id);
    if (!sedesBy.has(aid)) sedesBy.set(aid, []);
    sedesBy.get(aid).push(s);
  }
  const byCity = /* @__PURE__ */ new Map(), baseWrites = [];
  for (const adv of advertisers) {
    const aid = text41(adv.id || adv.anunciante_id), advSedes = sedesBy.get(aid) || [];
    const previousBase = await cache.get(guideAdvertiserKey(aid));
    const sedeCities = advSedes.map((s) => text41(s.ciudad_id)).filter(Boolean);
    const cities = [...new Set(sedeCities.length ? sedeCities : [text41(adv.ciudad_id), ...previousBase?.ciudades || []].filter(Boolean))];
    const cards = [];
    for (const cityId of cities) {
      const card = buildGuideCardBaseV2({
        advertiser: adv,
        admin: adminMap.get(aid) || {},
        sedes: advSedes,
        catalogs: catalogs || {},
        territory: territory || {},
        cityId
      });
      if (!card) continue;
      cards.push(card);
      if (publicAllowed(card)) {
        if (!byCity.has(cityId)) byCity.set(cityId, []);
        byCity.get(cityId).push(card);
      }
    }
    baseWrites.push(cache.put(guideAdvertiserKey(aid), {
      version: 2,
      anunciante_id: aid,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      ciudades: cities,
      template: cards[0] || previousBase?.template,
      cards
    }));
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    ...baseWrites,
    ...[...byCity.entries()].map(([cityId, cards]) => cache.put(guideCityKey2(cityId), {
      version: 2,
      ciudad_id: cityId,
      updated_at: now,
      anunciantes: sortCards2(cards)
    }))
  ]);
  return { success: true, ciudades: byCity.size, anunciantes: advertisers.length, updated_at: now };
}

// reconstruccion/worker/core/admin-indexes-v2.js
var text42 = (v) => String(v ?? "").trim();
var norm6 = (v) => text42(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
var ADMIN_ADVERTISERS_KEY = "admin:index:advertisers:v2";
var ADMIN_SUBSCRIBERS_KEY = "admin:index:subscribers:v2";
function sortByName(rows) {
  return [...rows].sort((a, b) => text42(a.nombre).localeCompare(text42(b.nombre), "es", { sensitivity: "base" }));
}
function advertiserRow({ advertiser, admin, sedes }) {
  const id4 = text42(advertiser && advertiser.id || admin && admin.id);
  const cities = [...new Set((sedes || []).map((s) => text42(s.ciudad_id)).filter(Boolean))];
  const nombre = text42(advertiser && advertiser.nombre || admin && admin.nombre);
  return {
    id: id4,
    nombre,
    nivel: text42(admin && admin.nivel),
    subnivel: text42(admin && admin.subnivel),
    aprobado: admin && admin.aprobado === true,
    verificado: admin && admin.verificado === true,
    gold: admin && admin.gold === true,
    segmento_id: text42(advertiser && advertiser.segmento_id),
    ciudad_ids: cities,
    search: norm6([id4, nombre, advertiser && advertiser.actividad, advertiser && advertiser.descripcion].filter(Boolean).join(" "))
  };
}
function subscriberRow(s) {
  const id4 = text42(s.suscriptor_id || s.id);
  const nombre = text42(s.nombre), mail = text42(s.mail), whatsapp = text42(s.whatsapp || s.telefono);
  return {
    suscriptor_id: id4,
    id: id4,
    nombre,
    mail,
    whatsapp,
    tipo_usuario: text42(s.tipo_usuario).toUpperCase(),
    ciudad_id: text42(s.ciudad_predeterminada_id || s.ciudad_origen_id || s.ciudad_id),
    activo: s.activo,
    search: norm6([id4, nombre, mail, whatsapp].join(" "))
  };
}
function upsert2(rows, idField, item) {
  const id4 = text42(item[idField] || item.id);
  const out2 = (rows || []).filter((x) => text42(x[idField] || x.id) !== id4);
  out2.push(item);
  return sortByName(out2);
}
async function rebuildAdminIndexesV2({ db, cache }) {
  const [advertisers, admins, sedes, subscribers] = await Promise.all([
    db.listCollection("anunciantes"),
    db.listCollection("anunciantes_administracion"),
    db.listCollection("anunciantes_sedes"),
    db.listCollection("suscriptores")
  ]);
  const adminMap = new Map(admins.map((a) => [text42(a.id || a.anunciante_id), a]));
  const sedesBy = /* @__PURE__ */ new Map();
  for (const s of sedes) {
    const aid = text42(s.anunciante_id);
    if (!aid) continue;
    if (!sedesBy.has(aid)) sedesBy.set(aid, []);
    sedesBy.get(aid).push(s);
  }
  const advRows = advertisers.map((a) => {
    const aid = text42(a.id || a.anunciante_id);
    return advertiserRow({ advertiser: a, admin: adminMap.get(aid) || {}, sedes: sedesBy.get(aid) || [] });
  }).filter((x) => x.id);
  const subRows = subscribers.map(subscriberRow).filter((x) => x.suscriptor_id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await Promise.all([
    cache.put(ADMIN_ADVERTISERS_KEY, { version: 2, updated_at: now, results: sortByName(advRows) }),
    cache.put(ADMIN_SUBSCRIBERS_KEY, { version: 2, updated_at: now, results: sortByName(subRows) })
  ]);
  return { success: true, anunciantes: advRows.length, suscriptores: subRows.length, updated_at: now };
}
async function syncAdvertiserIndexV2({ db, cache, advertiserId }) {
  const aid = text42(advertiserId);
  const [advertiser, admin, sedes, packet2] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500),
    cache.get(ADMIN_ADVERTISERS_KEY)
  ]);
  if (!advertiser && !admin) return { success: true, removed: false, missing: true };
  const row = advertiserRow({ advertiser: advertiser || { id: aid }, admin: admin || {}, sedes });
  const base2 = packet2 && Array.isArray(packet2.results) ? packet2.results : [];
  await cache.put(ADMIN_ADVERTISERS_KEY, {
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: upsert2(base2, "id", row)
  });
  return { success: true, row };
}
async function patchAdvertiserIndexCommercialV2({ cache, advertiserId, patch }) {
  const aid = text42(advertiserId), packet2 = await cache.get(ADMIN_ADVERTISERS_KEY);
  if (!packet2 || !Array.isArray(packet2.results)) return { success: true, changed: false, needs_rebuild: true };
  const rows = [...packet2.results];
  const i = rows.findIndex((x) => text42(x.id) === aid);
  if (i < 0) return { success: true, changed: false, needs_rebuild: true };
  const row = { ...rows[i] };
  for (const key3 of ["nivel", "subnivel", "aprobado", "verificado", "gold"]) {
    if (Object.prototype.hasOwnProperty.call(patch || {}, key3)) row[key3] = patch[key3];
  }
  rows[i] = row;
  await cache.put(ADMIN_ADVERTISERS_KEY, {
    ...packet2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: sortByName(rows)
  });
  return { success: true, changed: true };
}
async function searchAdvertisersV2({ cache, q = "", cityId = "", limit = 100 }) {
  const packet2 = await cache.get(ADMIN_ADVERTISERS_KEY);
  const needle = norm6(q), city = text42(cityId);
  let rows = packet2 && Array.isArray(packet2.results) ? packet2.results : [];
  if (needle) rows = rows.filter((x) => text42(x.search).includes(needle));
  if (city) rows = rows.filter((x) => Array.isArray(x.ciudad_ids) && x.ciudad_ids.includes(city));
  return { success: true, results: city&&!needle?rows:rows.slice(0, Math.max(1, Math.min(250, Number(limit) || 100))), source: "kv" };
}
async function searchSubscribersV2({ cache, q = "", tipo = "", limit = 100 }) {
  const packet2 = await cache.get(ADMIN_SUBSCRIBERS_KEY);
  const needle = norm6(q), wanted = text42(tipo).toUpperCase();
  let rows = packet2 && Array.isArray(packet2.results) ? packet2.results : [];
  if (needle) rows = rows.filter((x) => text42(x.search).includes(needle));
  if (wanted) rows = rows.filter((x) => text42(x.tipo_usuario).toUpperCase() === wanted);
  return { success: true, results: rows.slice(0, Math.max(1, Math.min(250, Number(limit) || 100))), source: "kv" };
}

function limiteGuardadasV62(admin, module, activeMax) {
  const cfg=admin?.funcionalidades_config?.[module]||{};
  for(const v of [cfg.guardadas_max,cfg.max_guardadas,cfg.guardadas]){
    if(v===undefined||v===null||v==='')continue;
    const n=Number(v);if(Number.isSafeInteger(n)&&n>=0)return n;
  }
  return Math.max(0,Number(activeMax)||0)*2;
}
async function advertiserUsageV62(db,aid){
  if(!db.cachedPanelRows)return {};
  const collections=['promos','eventos','actividades','publicidades'];
  const lists=await Promise.all(collections.map(c=>db.cachedPanelRows(c,'anunciante_id',aid)));
  const summary=(rows,active)=>rows===null?{disponible:false}:{disponible:true,guardadas:rows.length,activas:rows.filter(active).length,pausadas:rows.filter(r=>bool12(r.pausado)||r.activo===false||String(r.estado||'').toUpperCase()==='PAUSADA').length,pendientes:rows.filter(r=>String(r.estado_moderacion||r.estado||'').toUpperCase()==='PENDIENTE'||r.aprobado===false).length};
  return {
    PROMOS:summary(lists[0],r=>!paused(r)),
    EVENTOS:summary(lists[1]===null?null:lists[1].filter(isVip),r=>!bool12(r.pausado)),
    EVENTOS_FREE:summary(lists[1]===null?null:lists[1].filter(isFree),r=>!bool12(r.pausado)),
    ACTIVIDADES:summary(lists[2],r=>r.activo!==false&&String(r.estado||'').toUpperCase()!=='PAUSADA'),
    PUBLICIDAD:summary(lists[3],r=>String(r.estado||'').toUpperCase()==='ACTIVA')
  };
}

async function advertiserDetailV2({ db, advertiserId }) {
  const aid = text42(advertiserId);
  const [advertiser, admin, sedes, relations] = await Promise.all([
    db.get("anunciantes", aid),
    db.get("anunciantes_administracion", aid),
    db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500),
    db.queryEqual("suscriptor_anunciante", "anunciante_id", aid, 500)
  ]);
  if (!advertiser && !admin) return { success: false, message: "Anunciante no encontrado" };
  return { success: true, anunciante: advertiser || {}, administracion: admin || {}, sedes, relaciones: relations, uso_funcionalidades: await advertiserUsageV62(db,aid) };
}
async function subscriberDetailV2({ db, subscriberId }) {
  const sid = text42(subscriberId);
  const [subscriber, relations] = await Promise.all([
    db.get("suscriptores", sid),
    db.queryEqual("suscriptor_anunciante", "suscriptor_id", sid, 500)
  ]);
  if (!subscriber) return { success: false, message: "Suscriptor no encontrado" };
  return { success: true, suscriptor: subscriber, relaciones: relations };
}

// reconstruccion/worker/routes/panel-v5.js
var text43 = (v) => String(v ?? "").trim();
async function bodyOf3(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf3(url, b = {}) {
  return text43(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf3(url, b = {}) {
  return text43(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function requirePanel3(env, request2, aid, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (!sessionAllows(s, aid, "modificar_datos", { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
async function routePanelV5(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/commerce" && request2.method === "GET") {
    const action = actionOf3(url), aid = aidOf3(url);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel3(env, request2, aid, false);
    if (auth.response) return auth.response;
    if (action === "permisos_panel") {
      const admin = await (db.panelAdministration ? db.panelAdministration(aid) : db.get("anunciantes_administracion", aid));
      return json({ success: !!admin, id: aid, administracion: admin || {} }, admin ? 200 : 404);
    }
    if (action === "anunciante") {
      return json(await commercePanelData({
        db,
        advertiserId: aid,
        catalogs: await getCommerceCatalogs(cache)
      }));
    }
    return null;
  }
  if (path === "/commerce" && request2.method === "POST") {
    const body = await bodyOf3(request2), action = actionOf3(url, body), aid = aidOf3(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel3(env, request2, aid, true);
    if (auth.response) return auth.response;
    if (action === "set_datos") {
      const out2 = await commerceSetDatos({ db, advertiserId: aid, body });
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
      return json(out2);
    }
    if (action === "set_sedes") {
      const previous = await db.queryEqual("anunciantes_sedes", "anunciante_id", aid, 500);
      const previousCities = [...new Set(previous.map((x) => text43(x.ciudad_id)).filter(Boolean))];
      const out2 = await commerceSetSedes({ db, advertiserId: aid, body });
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid, affectedCityIds: previousCities }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
      return json(out2);
    }
    if (action === "set_relaciones_sede") {
      const out2 = await commerceSetRelacionesSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiserV2({ db, cache, advertiserId: aid });
      return json(out2);
    }
    if (action === "delete_sede") {
      const sedeId = text43(body.sede_id);
      const sede = sedeId ? await db.get("anunciantes_sedes", sedeId) : null;
      const previousCities = sede && text43(sede.ciudad_id) ? [text43(sede.ciudad_id)] : [];
      const out2 = await commerceDeleteSede({ db, advertiserId: aid, body });
      await syncGuideAdvertiserV2({ db, cache, advertiserId: aid, affectedCityIds: previousCities });
      return json(out2);
    }
    return null;
  }
  return routePanelV4(ctx);
}

// reconstruccion/worker/modules/suscriptor-favoritos-v2.js
var {listFavoritesV2,addFavoriteV2,removeFavoriteV2} = (() => {
/**
 * FAVORITOS SUSCRIPTOR V2
 * Requiere sesión HMAC. Nunca acepta suscriptor_id ajeno al token.
 */

const text=v=>String(v??"").trim();
const allowedTypes=new Set(["ANUNCIANTE","EVENTO","PROMO","ACTIVIDAD","CIUDAD"]);

function typeOf(v){
  const t=text(v).toUpperCase();
  return allowedTypes.has(t)?t:"";
}
async function favoriteDocId(sid,type,ref){
  const raw=new TextEncoder().encode([sid,type,ref].join("|"));
  const hash=await crypto.subtle.digest("SHA-256",raw);
  const bytes=new Uint8Array(hash);
  return "FAV-"+[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,40);
}
async function sessionOrThrow(env,request){
  const s=await verifySubscriberSession(env,request);
  if(!s.ok)throw new Error(s.message||"Sesión inválida.");
  return s;
}

async function listFavoritesV2({env,request,db,type=""}){
  const s=await sessionOrThrow(env,request);
  const wanted=typeOf(type);
  if(type&&!wanted)throw new Error("Tipo de favorito inválido.");

  const rows=await (db.subscriberFavorites?db.subscriberFavorites(text(s.sid)):db.queryEqual("suscriptor_favoritos","suscriptor_id",text(s.sid),500));
  const favoritos=rows
    .filter(x=>x.activo===undefined||x.activo===true)
    .filter(x=>!wanted||text(x.tipo).toUpperCase()===wanted);

  return{success:true,favoritos};
}

async function addFavoriteV2({env,request,db,body}){
  const s=await sessionOrThrow(env,request);
  const sid=text(s.sid);
  const tipo=typeOf(body&&body.tipo);
  const ref=text(body&&body.referencia_id);
  if(!tipo)throw new Error("Tipo de favorito inválido.");
  if(!ref)throw new Error("Falta referencia_id.");

  const id=await favoriteDocId(sid,tipo,ref);
  const now=new Date().toISOString();
  const doc={
    favorito_id:id,
    suscriptor_id:sid,
    tipo,
    referencia_id:ref,
    nombre_ref:text(body&&body.nombre_ref),
    ciudad_id:text(body&&body.ciudad_id),
    fecha_alta:now,
    activo:true,
    actualizado:now
  };
  await db.patch("suscriptor_favoritos",id,doc);
  return{success:true,message:"Favorito guardado",favorito:doc};
}

async function removeFavoriteV2({env,request,db,body}){
  const s=await sessionOrThrow(env,request);
  const sid=text(s.sid);
  const tipo=typeOf(body&&body.tipo);
  const ref=text(body&&body.referencia_id);
  if(!tipo)throw new Error("Tipo de favorito inválido.");
  if(!ref)throw new Error("Falta referencia_id.");

  const id=await favoriteDocId(sid,tipo,ref);
  const current=await db.get("suscriptor_favoritos",id);
  if(!current)return{success:true,message:"El favorito ya no existe"};
  if(text(current.suscriptor_id)!==sid)throw new Error("Favorito inválido.");

  await db.delete("suscriptor_favoritos",id,{mustExist:true});
  return{success:true,message:"Favorito eliminado",favorito:current};
}
return {listFavoritesV2,addFavoriteV2,removeFavoriteV2};
})();

// reconstruccion/worker/routes/panel-v6.js
var text45 = (v) => String(v ?? "").trim();
async function bodyOf4(request2) {
  try {
    return await request2.clone().json();
  } catch (_) {
    return {};
  }
}
async function routePanelV6(ctx) {
  const { path, request: request2, url, env, db } = ctx;
  if (path === "/suscriptores" && request2.method === "GET") {
    const action = text45(url.searchParams.get("action")).toLowerCase();
    if (action === "favoritos") {
      return json(await listFavoritesV2({
        env,
        request: request2,
        db,
        type: text45(url.searchParams.get("tipo"))
      }));
    }
  }
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf4(request2);
    const action = text45(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "agregar_favorito") {
      return json(await addFavoriteV2({ env, request: request2, db, body }));
    }
    if (action === "quitar_favorito") {
      return json(await removeFavoriteV2({ env, request: request2, db, body }));
    }
  }
  return routePanelV5(ctx);
}

// reconstruccion/worker/modules/suscriptor-cuenta-v2.js
var text46 = (v) => String(v ?? "").trim();
var norm7 = (v) => text46(v).toLowerCase();
var truthy4 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(norm7(v));
async function session(env, request2) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) throw new Error(s.message || "Sesión inválida.");
  return s;
}
function publicProfile(s) {
  return {
    suscriptor_id: text46(s.suscriptor_id || s.id),
    nombre: text46(s.nombre),
    mail: text46(s.mail),
    whatsapp: text46(s.whatsapp),
    tipo_usuario: text46(s.tipo_usuario),
    ciudad_origen_id: text46(s.ciudad_origen_id),
    ciudad_predeterminada_id: text46(s.ciudad_predeterminada_id),
    activo: s.activo
  };
}
async function createSubscriberV2({ db, body }) {
  const mail = norm7(body && body.mail), clave = text46(body && body.clave), nombre = text46(body && body.nombre);
  if (!mail || !clave || !nombre) throw new Error("Faltan nombre, mail o clave.");
  const exists = await db.queryEqual("suscriptores", "mail", mail, 5);
  if (exists.some((x) => norm7(x.mail) === mail)) throw new Error("Ya existe una cuenta con ese mail.");
  const id4 = "SUS-" + crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    suscriptor_id: id4,
    nombre,
    mail,
    clave,
    whatsapp: text46(body.whatsapp),
    tipo_usuario: text46(body.tipo_usuario || "RESIDENTE").toUpperCase(),
    ciudad_origen_id: text46(body.ciudad_origen_id),
    ciudad_predeterminada_id: text46(body.ciudad_predeterminada_id || body.ciudad_origen_id),
    activo: true,
    creado_en: now,
    actualizado_en: now
  };
  const saved = await db.patch("suscriptores", id4, doc);
  return { success: true, suscriptor: publicProfile(saved) };
}
async function getSubscriberProfileV2({ env, request: request2, db }) {
  const s = await session(env, request2);
  const doc = await db.get("suscriptores", text46(s.sid));
  if (!doc) throw new Error("Suscriptor no encontrado.");
  if (doc.activo !== void 0 && !truthy4(doc.activo)) throw new Error("Suscriptor no activo.");
  return { success: true, suscriptor: publicProfile(doc) };
}
async function updateSubscriberProfileV2({ env, request: request2, db, body }) {
  const s = await session(env, request2);
  const allowed = ["nombre", "whatsapp", "tipo_usuario", "ciudad_origen_id"];
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  for (const key3 of allowed) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key3)) patch[key3] = text46(body[key3]);
  }
  if (Object.keys(patch).length === 1) return { success: true, updated: false };
  const saved = await db.patch("suscriptores", text46(s.sid), patch, { mustExist: true });
  return { success: true, suscriptor: publicProfile(saved) };
}
async function updateSubscriberCityV2({ env, request: request2, db, cache, body }) {
  const s = await session(env, request2);
  const city = text46(body && body.ciudad_id || body && body.ciudad_predeterminada_id);
  if (!city) throw new Error("Falta ciudad_id.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || (territory.ciudades || []).every((c) => text46(c.ciudad_id || c.id) !== city)) {
    throw new Error("La ciudad indicada no existe o no está activa.");
  }
  const saved = await db.patch("suscriptores", text46(s.sid), {
    ciudad_predeterminada_id: city,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: true });
  return { success: true, suscriptor: publicProfile(saved) };
}
async function changeSubscriberPasswordV2({ env, request: request2, db, body }) {
  const s = await session(env, request2);
  const actual = text46(body && body.clave_actual || body && body.actual);
  const nueva = text46(body && body.clave_nueva || body && body.nueva_clave || body && body.clave);
  if (!actual || !nueva) throw new Error("Faltan clave actual o nueva clave.");
  if (nueva.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const doc = await db.get("suscriptores", text46(s.sid));
  if (!doc) throw new Error("Suscriptor no encontrado.");
  if (text46(doc.clave) !== actual) throw new Error("La clave actual no coincide.");
  await db.patch("suscriptores", text46(s.sid), {
    clave: nueva,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: true });
  await revokeSubscriberSessions(env, s.sid);
  return { success: true, message: "Clave actualizada. Volvé a ingresar." };
}
async function deleteSubscriberAccountV2({ env, request: request2, db }) {
  const s = await session(env, request2);
  const sid = text46(s.sid);
  const [relations, favorites] = await Promise.all([
    db.queryEqual("suscriptor_anunciante", "suscriptor_id", sid, 500),
    db.queryEqual("suscriptor_favoritos", "suscriptor_id", sid, 500)
  ]);
  for (const r of relations) {
    const id4 = text46(r.relacion_id || r.id);
    if (id4) await db.delete("suscriptor_anunciante", id4);
  }
  for (const f of favorites) {
    const id4 = text46(f.favorito_id || f.id);
    if (id4) await db.delete("suscriptor_favoritos", id4);
  }
  await db.delete("suscriptores", sid, { mustExist: true });
  return { success: true, deleted: true, suscriptor_id: sid };
}
async function recoveryBridgeV2({ env, body }) {
  const url = text46(env.SUSCRIPTORES_RECOVERY_URL);
  if (!url) throw new Error("Recuperación de contraseña no configurada.");
  const action = norm7(body && body.action || body && body.accion);
  if (!["solicitar_recuperacion", "restablecer_clave"].includes(action)) {
    throw new Error("Acción de recuperación inválida.");
  }
  const payload = {
    action,
    mail: text46(body && body.mail || body && body.email),
    codigo: text46(body && body.codigo || body && body.code),
    nueva_clave: text46(body && body.nueva_clave || body && body.clave_nueva || body && body.clave)
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new Error("El servicio de recuperación no respondió correctamente.");
  return data;
}

// reconstruccion/worker/routes/panel-v7.js
var text47 = (v) => String(v ?? "").trim();
async function bodyOf5(request2) {
  try {
    return await request2.clone().json();
  } catch (_) {
    return {};
  }
}
async function routePanelV7(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/suscriptores" && request2.method === "GET") {
    const action = text47(url.searchParams.get("action")).toLowerCase();
    if (action === "perfil" || action === "suscriptor") {
      return json(await getSubscriberProfileV2({ env, request: request2, db }));
    }
  }
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf5(request2);
    const action = text47(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "crear") return json(await createSubscriberV2({ db, body }));
    if (action === "actualizar_perfil") return json(await updateSubscriberProfileV2({ env, request: request2, db, body }));
    if (action === "actualizar_ciudad") return json(await updateSubscriberCityV2({ env, request: request2, db, cache, body }));
    if (action === "cambiar_clave") return json(await changeSubscriberPasswordV2({ env, request: request2, db, body }));
    if (action === "eliminar_cuenta") return json(await deleteSubscriberAccountV2({ env, request: request2, db }));
    if (action === "solicitar_recuperacion" || action === "restablecer_clave") {
      return json(await recoveryBridgeV2({ env, body }));
    }
  }
  return routePanelV6(ctx);
}

// reconstruccion/worker/modules/suscriptor-login-v2.js
var subscriberLoginV2 = (() => {
/**
 * SUSCRIPTOR LOGIN V2
 * Login con verificación de correo + sesión HMAC autosuficiente.
 */
const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase();
const truthy=v=>v===true||v===1||["true","1","si","sí","yes","x","activo","activa"].includes(norm(v));

function b64(input){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let bin="";bytes.forEach(x=>bin+=String.fromCharCode(x));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function hmac(env,value){
  const secret=text(env.SERVER_SECRET);
  if(!secret)throw new Error("Falta SERVER_SECRET");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return b64(new Uint8Array(sig));
}
async function issue(env,payload){
  const now=Date.now();
  const body=b64(JSON.stringify({...payload,iat:now,exp:now+8*60*60*1000,typ:"GLD_SUBSCRIBER"}));
  return body+"."+await hmac(env,body);
}
function publicSubscriber(s){
  return {
    suscriptor_id:text(s.suscriptor_id||s.id),
    nombre:text(s.nombre),
    mail:text(s.mail),
    whatsapp:text(s.whatsapp),
    tipo_usuario:text(s.tipo_usuario),
    ciudad_origen_id:text(s.ciudad_origen_id),
    ciudad_predeterminada_id:text(s.ciudad_predeterminada_id),
    activo:s.activo
  };
}
function perms(rel,admin){
  const raw=text(rel&&rel.permisos)||text(admin&&admin.funcionalidades);
  return raw.split(/[;,|\n]/).map(x=>text(x).toUpperCase()).filter(Boolean).join(", ");
}

async function subscriberLoginV2({env,db,body}){
  const originalMail=text(body&&body.mail);
  const mail=norm(originalMail),clave=text(body&&body.clave);
  if(!mail||!clave)return{success:false,message:"Falta mail o clave"};

  const sus=await db.loginAccount(mail,clave,originalMail);
  if(!sus)return{success:false,message:"Mail o clave incorrectos"};
  if(sus.activo!==undefined&&sus.activo!==null&&sus.activo!==""&&!truthy(sus.activo)){
    return{success:false,message:"Suscriptor no activo"};
  }
  if(sus.email_verificado===false||norm(sus.email_verificado)==="false"){
    return{success:false,message:"Primero verificá tu correo electrónico.",requiere_verificacion:true,mail:text(sus.mail||mail)};
  }

  const sid=text(sus.suscriptor_id||sus.id);
  const state=await subscriberSessionState(env,sid);
  if(state.deleted)return{success:false,message:"Suscriptor no activo"};
  const relations=(await (db.loginRelations?db.loginRelations(sid):db.queryEqual("suscriptor_anunciante","suscriptor_id",sid,100)))
    .filter(r=>text(r.anunciante_id)&&truthy(r.activo));

  const enriched=await Promise.all(relations.map(async rel=>{
    const aid=text(rel.anunciante_id);
    const [advertiser,admin]=await Promise.all([
      text(rel.anunciante_nombre)?null:(db.loginAdvertiser?db.loginAdvertiser("anunciantes",aid):db.get("anunciantes",aid)),
      text(rel.permisos)?null:(db.loginAdvertiser?db.loginAdvertiser("anunciantes_administracion",aid):db.get("anunciantes_administracion",aid))
    ]);
    return {
      suscriptor_id:sid,
      anunciante_id:aid,
      anunciante_nombre:text(rel.anunciante_nombre||(advertiser&&advertiser.nombre)||(admin&&admin.nombre)),
      rol:text(rel.rol).toUpperCase(),
      permisos:perms(rel,admin),
      activo:true
    };
  }));

  const token=await issue(env,{
    sid,
    sv:Number(state.version||0),
    auth:enriched.map(x=>({
      anunciante_id:x.anunciante_id,
      anunciante_nombre:x.anunciante_nombre,
      rol:x.rol,
      permisos:x.permisos
    }))
  });

  return {
    success:true,
    suscriptor:publicSubscriber(sus),
    anunciantes:enriched,
    token,
    expires_in_seconds:8*60*60,
    source:"firestore"
  };
}
return subscriberLoginV2;
})();

// reconstruccion/worker/modules/suscriptor-registro-v3.js
var text49 = (v) => String(v ?? "").trim();
var norm9 = (v) => text49(v).toLowerCase();
function publicProfile2(s) {
  return {
    suscriptor_id: text49(s.suscriptor_id || s.id),
    nombre: text49(s.nombre),
    mail: text49(s.mail),
    whatsapp: text49(s.whatsapp),
    fecha_nacimiento: text49(s.fecha_nacimiento),
    tipo_usuario: text49(s.tipo_usuario),
    ciudad_origen_id: text49(s.ciudad_origen_id),
    ciudad_origen_otro: text49(s.ciudad_origen_otro),
    provincia_origen: text49(s.provincia_origen),
    ciudad_predeterminada_id: text49(s.ciudad_predeterminada_id),
    activo: s.activo,
    email_verificado: s.email_verificado
  };
}
async function createSubscriberV3({ db, body }) {
  const mail = norm9(body && body.mail), clave = text49(body && body.clave), nombre = text49(body && body.nombre);
  if (!mail || !clave || !nombre) throw new Error("Faltan nombre, mail o clave.");
  if (clave.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const exists = await db.queryEqual("suscriptores", "mail", mail, 5);
  if (exists.some((x) => norm9(x.mail) === mail)) throw new Error("Ya existe una cuenta con ese mail.");
  const id4 = "SUS-" + crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    suscriptor_id: id4,
    nombre,
    mail,
    clave,
    whatsapp: text49(body.whatsapp),
    fecha_nacimiento: text49(body.fecha_nacimiento),
    tipo_usuario: text49(body.tipo_usuario || "RESIDENTE").toUpperCase(),
    ciudad_origen_id: text49(body.ciudad_origen_id),
    ciudad_origen_otro: text49(body.ciudad_origen_otro),
    provincia_origen: text49(body.provincia_origen),
    ciudad_predeterminada_id: text49(body.ciudad_predeterminada_id),
    activo: true,
    email_verificado: false,
    email_verificado_fecha: "",
    fecha_alta: now,
    creado_en: now,
    actualizado_en: now,
    ultimo_acceso: ""
  };
  const saved = await db.patch("suscriptores", id4, doc);
  return { success: true, message: "Suscriptor creado", suscriptor: publicProfile2(saved) };
}

// reconstruccion/worker/core/subscriber-index-v2.js
var text50 = (v) => String(v ?? "").trim();
var norm10 = (v) => text50(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
function rowOf(s) {
  const id4 = text50(s && s.suscriptor_id || s && s.id);
  const nombre = text50(s && s.nombre), mail = text50(s && s.mail), whatsapp = text50(s && s.whatsapp);
  return {
    suscriptor_id: id4,
    id: id4,
    nombre,
    mail,
    whatsapp,
    tipo_usuario: text50(s && s.tipo_usuario).toUpperCase(),
    ciudad_id: text50(s && s.ciudad_predeterminada_id || s && s.ciudad_origen_id || s && s.ciudad_id),
    activo: s && s.activo,
    search: norm10([id4, nombre, mail, whatsapp].join(" "))
  };
}
function sort7(rows) {
  return [...rows].sort((a, b) => text50(a.nombre).localeCompare(text50(b.nombre), "es", { sensitivity: "base" }));
}
async function upsertSubscriberIndexV2({ cache, subscriber }) {
  const row = rowOf(subscriber);
  if (!row.suscriptor_id) return { success: true, changed: false };
  const packet2 = await cache.get(ADMIN_SUBSCRIBERS_KEY) || { version: 2, results: [] };
  const rows = (packet2.results || []).filter((x) => text50(x.suscriptor_id || x.id) !== row.suscriptor_id);
  rows.push(row);
  await cache.put(ADMIN_SUBSCRIBERS_KEY, {
    ...packet2,
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: sort7(rows)
  });
  return { success: true, changed: true };
}
async function removeSubscriberIndexV2({ cache, subscriberId }) {
  const sid = text50(subscriberId);
  const packet2 = await cache.get(ADMIN_SUBSCRIBERS_KEY) || { version: 2, results: [] };
  const rows = (packet2.results || []).filter((x) => text50(x.suscriptor_id || x.id) !== sid);
  await cache.put(ADMIN_SUBSCRIBERS_KEY, {
    ...packet2,
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    results: sort7(rows)
  });
  return { success: true, changed: true };
}

// reconstruccion/worker/modules/suscriptor-mail-v2.js
var text51 = (v) => String(v ?? "").trim();
var norm11 = (v) => text51(v).toLowerCase();
async function subscriberMailBridgeV2({ env, db, cache, body }) {
  const url = text51(env.SUSCRIPTORES_RECOVERY_URL);
  if (!url) throw new Error("Servicio de correo de suscriptores no configurado.");
  const action = norm11(body && body.action || body && body.accion);
  const allowed = /* @__PURE__ */ new Set([
    "solicitar_recuperacion",
    "restablecer_clave",
    "solicitar_verificacion",
    "confirmar_verificacion"
  ]);
  if (!allowed.has(action)) throw new Error("Acción de correo inválida.");
  const payload = {
    action,
    mail: text51(body && body.mail || body && body.email),
    codigo: text51(body && body.codigo || body && body.code),
    clave_nueva: text51(body && body.clave_nueva || body && body.nueva_clave || body && body.clave)
  };
  payload.mail = norm11(payload.mail);
  if (!payload.mail || !/^\S+@\S+\.\S+$/.test(payload.mail)) throw new Error("Ingresá un mail válido.");
  const confirmation = ["restablecer_clave", "confirmar_verificacion"].includes(action);
  if (confirmation && !/^\d{6}$/.test(payload.codigo)) throw new Error("Ingresá el código de 6 números.");
  if (action === "restablecer_clave" && payload.clave_nueva.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  payload.nueva_clave = payload.clave_nueva;
  payload.serverSecret = text51(env.SERVER_SECRET);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15e3);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || typeof data.success !== "boolean") throw new Error("El servicio de correo no respondió correctamente.");
    if (!data.success || !confirmation) return data;
    const rows = await db.queryEqual("suscriptores", "mail", payload.mail, 5);
    const current = rows.find((s) => norm11(s.mail) === payload.mail);
    if (!current) throw new Error("Cuenta no encontrada al confirmar el código.");
    const sid = text51(current.suscriptor_id || current.id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const patch = action === "confirmar_verificacion" ? { email_verificado: true, email_verificado_fecha: now, actualizado_en: now } : { clave: payload.clave_nueva, actualizado_en: now };
    const changed = action === "confirmar_verificacion" ? current.email_verificado !== true : text51(current.clave) !== payload.clave_nueva;
    const saved = changed ? await db.patch("suscriptores", sid, patch, { mustExist: true }) : current;
    if (action === "restablecer_clave") await revokeSubscriberSessions(env, sid);
    await upsertSubscriberIndexV2({ cache, subscriber: saved });
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("El servicio de correo demoró demasiado. Volvé a intentar.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// reconstruccion/worker/routes/panel-v8.js
var text52 = (v) => String(v ?? "").trim();
async function bodyOf6(request2) {
  try {
    return await request2.clone().json();
  } catch (_) {
    return {};
  }
}
async function routePanelV8(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/suscriptores" && request2.method === "GET") {
    const action = text52(url.searchParams.get("action")).toLowerCase();
    if (action === "anunciantes_autorizados") {
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      return json({
        success: true,
        anunciantes: (Array.isArray(s.auth) ? s.auth : []).map((x) => ({
          anunciante_id: text52(x.anunciante_id),
          anunciante_nombre: text52(x.anunciante_nombre),
          rol: text52(x.rol),
          permisos: text52(x.permisos),
          activo: true
        })),
        source: "session"
      });
    }
  }
  if (path === "/suscriptores" && request2.method === "POST") {
    const body = await bodyOf6(request2);
    const action = text52(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "login") {
      const out2 = await subscriberLoginV2({ env, db, body });
      return json(out2, out2.success ? 200 : 401);
    }
    if (action === "crear") {
      const out2 = await createSubscriberV3({ db, body });
      if (out2.success && out2.suscriptor) {
        await upsertSubscriberIndexV2({ cache, subscriber: out2.suscriptor });
      }
      return json(out2);
    }
    if (action === "solicitar_recuperacion" || action === "restablecer_clave" || action === "solicitar_verificacion" || action === "confirmar_verificacion") {
      return json(await subscriberMailBridgeV2({ env, db, cache, body }));
    }
    if (action === "actualizar_perfil") {
      const out2 = await updateSubscriberProfileV2({ env, request: request2, db, body });
      if (out2.success && out2.suscriptor) {
        await upsertSubscriberIndexV2({ cache, subscriber: out2.suscriptor });
      }
      return json(out2);
    }
    if (action === "actualizar_ciudad") {
      const out2 = await updateSubscriberCityV2({ env, request: request2, db, cache, body });
      if (out2.success && out2.suscriptor) {
        await upsertSubscriberIndexV2({ cache, subscriber: out2.suscriptor });
      }
      return json(out2);
    }
    if (action === "eliminar_cuenta") {
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      const sid = text52(s.sid);
      const out2 = await deleteSubscriberAccountV2({ env, request: request2, db });
      if (out2.success) await removeSubscriberIndexV2({ cache, subscriberId: sid });
      return json(out2);
    }
  }
  return routePanelV7(ctx);
}

// reconstruccion/worker/modules/suscriptor-delete-v2.js
var text53 = (v) => String(v ?? "").trim();
async function deleteSubscriberAccountSecureV2({ env, request: request2, db, body }) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) throw new Error(s.message || "Sesión inválida.");
  const sid = text53(s.sid);
  const clave = text53(body && body.clave_actual);
  if (!clave) throw new Error("Ingresá tu contraseña actual.");
  const current = await db.get("suscriptores", sid);
  if (!current) throw new Error("Suscriptor no encontrado.");
  if (text53(current.clave) !== clave) throw new Error("La contraseña actual no coincide.");
  const [relations, favorites] = await Promise.all([
    db.queryEqual("suscriptor_anunciante", "suscriptor_id", sid, 500),
    db.queryEqual("suscriptor_favoritos", "suscriptor_id", sid, 500)
  ]);
  for (const r of relations) {
    const id4 = text53(r.relacion_id || r.id);
    if (id4) await db.delete("suscriptor_anunciante", id4);
  }
  for (const f of favorites) {
    const id4 = text53(f.favorito_id || f.id);
    if (id4) await db.delete("suscriptor_favoritos", id4);
  }
  await db.delete("suscriptores", sid, { mustExist: true });
  await revokeSubscriberSessions(env, sid, { deleted: true });
  return { success: true, deleted: true, suscriptor_id: sid };
}

// reconstruccion/worker/routes/panel-v9.js
var text54 = (v) => String(v ?? "").trim();
async function bodyOf7(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
async function routePanelV9(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/suscriptores" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf7(clone);
    const action = text54(body.action || body.accion || url.searchParams.get("action")).toLowerCase();
    if (action === "eliminar_cuenta") {
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      const out2 = await deleteSubscriberAccountSecureV2({ env, request: request2, db, body });
      if (out2.success) {
        await removeSubscriberIndexV2({ cache, subscriberId: text54(s.sid) });
      }
      return json(out2);
    }
  }
  return routePanelV8(ctx);
}

// reconstruccion/worker/modules/commerce-v3.js
var {commercePanelDataV3,commerceSetDatosV3,commerceSetSedesV3,commerceDeleteSedeV3} = (() => {
function text(v){return String(v??"").trim();}
function ids(v){
  if(Array.isArray(v))return [...new Set(v.map(text).filter(Boolean))];
  return [...new Set(text(v).split(/[;,|\n]/).map(text).filter(Boolean))];
}
function newSedeId(advertiserId){
  return "SED-"+text(advertiserId)+"-"+crypto.randomUUID().replace(/-/g,"").slice(0,10);
}
const DATA_ALLOWED=new Set([
  "actividad","descripcion","tags","adicionales","logo","link","segmento_id","categoria_id","categoria_ids",
  "img1","img2","img3","img4","img5","img6","img7","img8","img9","img10"
]);
const SEDE_ALLOWED=new Set([
  "nombre_sede","direccion","lat","lng","maps",
  "telefono","telefono2","telefono3","telefono4","telefono5",
  "whatsapp","whatsapp2","whatsapp3","whatsapp4","whatsapp5",
  "mail","mail2","mail3","instagram","facebook","youtube","tiktok","linkedin","x",
  "img1","img2","img3","img4","img5","img6","img7","img8","img9","img10",
  "estado","ciudad_id","pais_id","provincia_id","codigo_postal","actividad_ids","accion_ids","nodo_ids"
]);

async function commercePanelDataV3({db,advertiserId,catalogs}){
  if(db.panelReadDb)db=db.panelReadDb();
  const [datos,administracion,sedes]=await Promise.all([
    db.get("anunciantes",advertiserId),
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("anunciantes_sedes","anunciante_id",advertiserId,500)
  ]);
  if(!datos)return{success:false,error:"anunciante_no_encontrado"};
  return{success:true,advertiser:{
    id:advertiserId,datos,administracion:administracion||{},sedes,
    segmentos:catalogs.segmentos||[],categorias:catalogs.categorias||[],
    actividades_clave:catalogs.actividades_clave||[],acciones:catalogs.acciones||[],
    nodos:catalogs.nodos||[],funcionalidades:catalogs.funcionalidades||[],
    niveles_anunciante:catalogs.niveles_anunciante||[]
  }};
}

async function commerceSetDatosV3({db,advertiserId,body}){
  const patch={actualizado_en:new Date().toISOString()};
  for(const [k,v] of Object.entries(body||{})){
    if(!DATA_ALLOWED.has(k))continue;
    if(k==="categoria_id"||k==="categoria_ids")patch.categoria_ids=ids(v);
    else patch[k]=v;
  }
  if(Object.keys(patch).length===1)return{success:true,updated:false,id:advertiserId,patch:{}};
  const saved=await db.patch("anunciantes",advertiserId,patch,{mustExist:true});
  return{success:true,updated:true,id:advertiserId,patch,advertiser:saved};
}

async function commerceSetSedesV3({db,cache,advertiserId,body}){
  const incoming=Array.isArray(body&&body.sedes)?body.sedes:[];
  if(incoming.length>100)throw new Error('Demasiadas sedes en una operación.');
  const territory=incoming.length?await cache.get('territorio:public:v1'):null;
  const prepared=[],seen=new Set();
  // Validar toda la operación antes de escribir: una sede ajena no deja cambios parciales.
  for(const raw of incoming){
    const existingId=text(raw&&raw.sede_id);
    const id=existingId||newSedeId(advertiserId);
    if(seen.has(id))throw new Error('Sede repetida en la operación.');
    seen.add(id);
    const current=existingId?await db.get('anunciantes_sedes',id):null;
    if(existingId&&(!current||text(current.anunciante_id)!==text(advertiserId)))throw new Error('La sede no pertenece al anunciante.');
    const patch={sede_id:id,anunciante_id:advertiserId};
    for(const [k,v] of Object.entries(raw||{})){
      if(SEDE_ALLOWED.has(k))patch[k]=['actividad_ids','accion_ids','nodo_ids'].includes(k)?ids(v):v;
    }
    const city=text(patch.ciudad_id??current?.ciudad_id);
    if(!city||!(territory&&territory.ciudades||[]).some(c=>text(c.ciudad_id||c.id)===city))throw new Error('Seleccioná una ciudad válida para la sede.');
    prepared.push({id,patch,current,existingId});
  }
  const saved=[],changed=[];
  for(const {id,patch,current,existingId} of prepared){
    if(current&&Object.entries(patch).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v))){saved.push(current);continue;}
    if(current)for(const k of Object.keys(patch)){
      if(JSON.stringify(current[k])===JSON.stringify(patch[k]))delete patch[k];
    }
    patch.actualizado_en=new Date().toISOString();
    const doc=await db.patch('anunciantes_sedes',id,patch,{mustExist:!!existingId,newDocument:!existingId});
    saved.push(doc);changed.push(doc);
  }
  return{success:true,updated:!!changed.length,id:advertiserId,sedes:saved,changed_sedes:changed};
}

async function commerceDeleteSedeV3({db,advertiserId,body}){
  const id=text(body&&body.sede_id);
  if(!id)throw new Error("Falta sede_id.");
  const current=await db.get("anunciantes_sedes",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La sede no pertenece al anunciante.");
  await db.delete("anunciantes_sedes",id,{mustExist:true});
  return{success:true,deleted:true,sede_id:id,previous:current};
}
return {commercePanelDataV3,commerceSetDatosV3,commerceSetSedesV3,commerceDeleteSedeV3};
})();

// reconstruccion/worker/core/commerce-cache-patch-v2.js
var text56 = (v) => String(v ?? "").trim();
var ids5 = (v) => Array.isArray(v) ? v.map(text56).filter(Boolean) : text56(v).split(/[;,|\n]/).map(text56).filter(Boolean);
function sortCards3(rows) {
  return [...rows].sort((a, b) => text56(a.nombre).localeCompare(text56(b.nombre), "es", { sensitivity: "base" }));
}
function mapBy3(rows, field) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows || []) {
    const id4 = text56(r && r[field] || r && r.id);
    if (id4) m.set(id4, r);
  }
  return m;
}
function relObjects3(values, map, idField) {
  return ids5(values).map((id4) => {
    const x = map.get(id4) || {};
    return { [idField]: id4, nombre: text56(x.nombre), insignia: text56(x.insignia) };
  });
}
async function writeCityPacket(cache, cityId, aid, card) {
  const key3 = guideCityKey2(cityId);
  const packet2 = await cache.get(key3) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
  let rows = (packet2.anunciantes || []).filter((x) => text56(x.id) !== text56(aid));
  if (card && card.aprobado !== false) rows.push(card);
  await cache.put(key3, { version: 2, ciudad_id: cityId, updated_at: (/* @__PURE__ */ new Date()).toISOString(), anunciantes: sortCards3(rows) });
}
function updateIndexRow(row, patch) {
  const out2 = { ...row };
  if ("nombre" in patch) out2.nombre = text56(patch.nombre);
  if ("segmento_id" in patch) out2.segmento_id = text56(patch.segmento_id);
  const searchable = ["nombre", "actividad", "descripcion"];
  if (searchable.some((k) => Object.prototype.hasOwnProperty.call(patch, k))) {
    const current = [out2.id, out2.nombre, patch.actividad ?? row.actividad, patch.descripcion ?? row.descripcion].filter(Boolean).join(" ");
    out2.search = text56(current).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  return out2;
}
async function patchAdminIndex(cache, aid, patch, cities) {
  const packet2 = await cache.get(ADMIN_ADVERTISERS_KEY);
  if (!packet2 || !Array.isArray(packet2.results)) return;
  const rows = [...packet2.results];
  const i = rows.findIndex((x) => text56(x.id) === text56(aid));
  if (i < 0) return;
  let row = updateIndexRow(rows[i], patch || {});
  if (Array.isArray(cities)) row.ciudad_ids = [...new Set(cities.map(text56).filter(Boolean))];
  rows[i] = row;
  await cache.put(ADMIN_ADVERTISERS_KEY, { ...packet2, updated_at: (/* @__PURE__ */ new Date()).toISOString(), results: sortCards3(rows) });
}
function sedePublic(raw, { territory, catalogs }) {
  const cityId = text56(raw.ciudad_id);
  const city = (territory.ciudades || []).find((c) => text56(c.ciudad_id || c.id) === cityId) || {};
  const actMap = mapBy3(catalogs.actividades_clave, "actividad_id");
  const accMap = mapBy3(catalogs.acciones, "accion_id");
  const nodeMap = mapBy3(catalogs.nodos, "nodo_id");
  return {
    sede_id: text56(raw.sede_id || raw.id),
    nombre_sede: text56(raw.nombre_sede),
    direccion: text56(raw.direccion),
    ciudad_id: cityId,
    ciudad: text56(raw.ciudad || city.ciudad_visible),
    provincia_id: text56(raw.provincia_id || city.provincia_id),
    provincia: text56(raw.provincia || city.provincia_visible),
    pais_id: text56(raw.pais_id || city.pais_id),
    pais: text56(raw.pais || city.pais_visible),
    codigo_postal: text56(raw.codigo_postal || city.codigo_postal),
    lat: raw.lat ?? "",
    lng: raw.lng ?? "",
    maps: text56(raw.maps),
    telefono: text56(raw.telefono),
    telefono2: text56(raw.telefono2),
    telefono3: text56(raw.telefono3),
    telefono4: text56(raw.telefono4),
    telefono5: text56(raw.telefono5),
    whatsapp: text56(raw.whatsapp),
    whatsapp2: text56(raw.whatsapp2),
    whatsapp3: text56(raw.whatsapp3),
    whatsapp4: text56(raw.whatsapp4),
    whatsapp5: text56(raw.whatsapp5),
    mail: text56(raw.mail),
    mail2: text56(raw.mail2),
    mail3: text56(raw.mail3),
    instagram: text56(raw.instagram),
    facebook: text56(raw.facebook),
    youtube: text56(raw.youtube),
    tiktok: text56(raw.tiktok),
    x: text56(raw.x),
    linkedin: text56(raw.linkedin),
    estado: text56(raw.estado),
    actividades: relObjects3(raw.actividad_ids, actMap, "actividad_id"),
    acciones: relObjects3(raw.accion_ids, accMap, "accion_id"),
    nodos: relObjects3(raw.nodo_ids, nodeMap, "nodo_id"),
    img1: text56(raw.img1),
    img2: text56(raw.img2),
    img3: text56(raw.img3),
    img4: text56(raw.img4),
    img5: text56(raw.img5),
    img6: text56(raw.img6),
    img7: text56(raw.img7),
    img8: text56(raw.img8),
    img9: text56(raw.img9),
    img10: text56(raw.img10)
  };
}
function applyCardData(card, patch, catalogs) {
  const out2 = { ...card };
  const direct = ["nombre", "actividad", "descripcion", "tags", "adicionales", "logo", "link", "img1", "img2", "img3", "img4", "img5", "img6", "img7", "img8", "img9", "img10"];
  for (const k of direct) if (Object.prototype.hasOwnProperty.call(patch, k)) out2[k] = text56(patch[k]);
  for (const k of ["pet", "eco", "gayfriendly"]) if (Object.prototype.hasOwnProperty.call(patch, k)) out2[k] = patch[k];
  if (Object.prototype.hasOwnProperty.call(patch, "segmento_id")) {
    const sid = text56(patch.segmento_id);
    const x = (catalogs.segmentos || []).find((s) => text56(s.segmento_id || s.id) === sid) || {};
    out2.segmento_id = sid;
    out2.segmento = text56(x.nombre);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "categoria_ids") || Object.prototype.hasOwnProperty.call(patch, "categoria_id")) {
    const vals = ids5(patch.categoria_ids ?? patch.categoria_id);
    const map = mapBy3(catalogs.categorias, "categoria_id");
    out2.categoria_ids = vals;
    out2.categorias = vals.map((id4) => map.get(id4)).filter(Boolean).map((x) => text56(x.nombre)).filter(Boolean);
  }
  return out2;
}
async function patchGuideAdvertiserDataFromCacheV2({ cache, advertiserId, patch }) {
  const aid = text56(advertiserId);
  const [base2, catalogs] = await Promise.all([
    cache.get(guideAdvertiserKey(aid)),
    cache.get("catalogs:commerce:v1")
  ]);
  if (!base2 || !Array.isArray(base2.cards)) return { success: true, needs_seed: true };
  const cards = base2.cards.map((c) => applyCardData(c, patch, catalogs || {}));
  const template = applyCardData(base2.template || base2.cards[0] || {}, patch, catalogs || {});
  for (const card of cards) await writeCityPacket(cache, text56(card.ciudad_id), aid, card);
  await cache.put(guideAdvertiserKey(aid), { ...base2, updated_at: (/* @__PURE__ */ new Date()).toISOString(), template, cards });
  await patchAdminIndex(cache, aid, patch, base2.ciudades || []);
  return { success: true, updated: true, firestore_reads: 0 };
}
async function patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId, savedSedes = [], deletedSedeId = "" }) {
  const aid = text56(advertiserId);
  const [base2, catalogs, territory] = await Promise.all([
    cache.get(guideAdvertiserKey(aid)),
    cache.get("catalogs:commerce:v1"),
    cache.get("territorio:public:v1")
  ]);
  if (!base2 || !Array.isArray(base2.cards)) return { success: true, needs_seed: true };
  const cards = new Map((base2.cards || []).map((c) => [text56(c.ciudad_id), { ...c, sedes: [...c.sedes || []] }]));
  const affected = /* @__PURE__ */ new Set();
  const removeSede = (id4) => {
    for (const [city, card] of cards) {
      const before = (card.sedes || []).length;
      card.sedes = (card.sedes || []).filter((s) => text56(s.sede_id) !== text56(id4));
      if (card.sedes.length !== before) affected.add(city);
    }
  };
  if (deletedSedeId) removeSede(deletedSedeId);
  for (const raw of savedSedes || []) {
    const sid = text56(raw.sede_id || raw.id);
    if (!sid) continue;
    removeSede(sid);
    const cityId = text56(raw.ciudad_id);
    if (!cityId) continue;
    let card = cards.get(cityId);
    if (!card) {
      const template = base2.template || [...cards.values()][0] || (base2.cards || [])[0];
      if (!template) continue;
      const city = (territory && territory.ciudades || []).find((c) => text56(c.ciudad_id || c.id) === cityId) || {};
      card = { ...template, ciudad_id: cityId, ciudad: text56(city.ciudad_visible), provincia_id: text56(city.provincia_id), provincia: text56(city.provincia_visible), pais_id: text56(city.pais_id), pais: text56(city.pais_visible), sedes: [] };
      cards.set(cityId, card);
    }
    card.sedes.push(sedePublic(raw, { territory: territory || {}, catalogs: catalogs || {} }));
    affected.add(cityId);
  }
  const hasSedes = [...cards.values()].some((c) => (c.sedes || []).length);
  for (const [city, card] of [...cards.entries()]) {
    if (hasSedes && !(card.sedes || []).length) {
      cards.delete(city);
      affected.add(city);
    }
  }
  for (const city of affected) {
    await writeCityPacket(cache, city, aid, cards.get(city) || null);
  }
  const nextCards = [...cards.values()];
  const ciudades = nextCards.map((c) => text56(c.ciudad_id)).filter(Boolean);
  await cache.put(guideAdvertiserKey(aid), { ...base2, updated_at: (/* @__PURE__ */ new Date()).toISOString(), template: base2.template || base2.cards[0], ciudades, cards: nextCards });
  await patchAdminIndex(cache, aid, {}, ciudades);
  return { success: true, updated: true, ciudades_actualizadas: [...affected], firestore_reads: 0 };
}

// reconstruccion/worker/routes/panel-v10.js
var text57 = (v) => String(v ?? "").trim();
async function bodyOf8(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf4(url, b = {}) {
  return text57(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf4(url, b = {}) {
  return text57(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function requirePanel4(env, request2, aid, write = false) {
  const s = await verifySubscriberSession(env, request2);
  if (!s.ok) return { response: json({ success: false, message: s.message }, 401) };
  if (!sessionAllows(s, aid, "modificar_datos", { write })) {
    return { response: json({ success: false, message: "No tenés permiso para esta operación." }, 403) };
  }
  return { session: s };
}
async function routePanelV10(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/commerce" && request2.method === "GET") {
    const action = actionOf4(url), aid = aidOf4(url);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel4(env, request2, aid, false);
    if (auth.response) return auth.response;
    if (action === "permisos_panel") {
      const admin = await (db.panelAdministration ? db.panelAdministration(aid) : db.get("anunciantes_administracion", aid));
      return json({ success: !!admin, id: aid, administracion: admin || {} }, admin ? 200 : 404);
    }
    if (action === "anunciante") {
      return json(await commercePanelDataV3({ db, advertiserId: aid, catalogs: await getCommerceCatalogs(cache) }));
    }
    return null;
  }
  if (path === "/commerce" && request2.method === "POST") {
    const body = await bodyOf8(request2), action = actionOf4(url, body), aid = aidOf4(url, body);
    if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
    const auth = await requirePanel4(env, request2, aid, true);
    if (auth.response) return auth.response;
    if (action === "set_datos") {
      const out2 = await commerceSetDatosV3({ db, advertiserId: aid, body });
      if (out2.updated) {
        await patchGuideAdvertiserDataFromCacheV2({ cache, advertiserId: aid, patch: out2.patch || {} });
      }
      return json(out2);
    }
    if (action === "set_sedes") {
      const out2 = await commerceSetSedesV3({ db, cache, advertiserId: aid, body });
      if (out2.updated) {
        await patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId: aid, savedSedes: out2.changed_sedes || [] });
      }
      return json(out2);
    }
    if (action === "delete_sede") {
      const out2 = await commerceDeleteSedeV3({ db, advertiserId: aid, body });
      await patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId: aid, deletedSedeId: out2.sede_id });
      return json(out2);
    }
    return null;
  }
  return routePanelV9(ctx);
}

// reconstruccion/worker/modules/promos-panel-v3.js
var text58 = (v) => String(v ?? "").trim();
async function promoListOwnV3({ db, advertiserId }) {
  if(db.panelReadDb)db=db.panelReadDb();
  const promos = await db.queryEqual("promos", "anunciante_id", text58(advertiserId), 500);
  return {
    success: true,
    promos,
    rows: promos,
    count: promos.length
  };
}

// reconstruccion/worker/routes/panel-v11.js
var text59 = (v) => String(v ?? "").trim();
async function bodyOf9(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf5(url, b = {}) {
  return text59(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf5(url, b = {}) {
  return text59(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function routePanelV11(ctx) {
  const { path, request: request2, url, env, db } = ctx;
  if (path === "/promos" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf9(clone);
    const action = actionOf5(url, body);
    if (action === "getpromos") {
      const aid = aidOf5(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "promos", { write: false })) {
        return json({ success: false, message: "No tenés permiso para ver Promos." }, 403);
      }
      return json(await promoListOwnV3({ db, advertiserId: aid }));
    }
  }
  return routePanelV10(ctx);
}

// reconstruccion/worker/core/child-rows-patch-v1.js
var {patchChildRowsV1} = (() => {
const text=v=>String(v??'').trim();
// Sólo reutiliza IDs que pertenecen al padre consultado; conserva filas sin cambios.
async function patchChildRowsV1({db,collection,idField,prefix,previous=[],desired=[],matchKey=undefined}){
  if(db.rememberPanelRows)db.rememberPanelRows(collection,previous);
  const byId=new Map(previous.map(r=>[text(r[idField]||r.id),r]));
  const used=new Set(),prepared=[];
  for(let i=0;i<desired.length;i++){
    const raw=desired[i],requested=text(raw[idField]);
    let current=requested?byId.get(requested):null;
    if(requested&&used.has(requested))throw new Error('Fila repetida en la operación.');
    if(!current&&matchKey)current=previous.find(r=>!used.has(text(r[idField]||r.id))&&matchKey(r)===matchKey(raw));
    if(!current&&!requested&&!matchKey)current=previous[i];
    const id=current?text(current[idField]||current.id):prefix+'-'+crypto.randomUUID();
    if(used.has(id))throw new Error('Fila repetida en la operación.');
    used.add(id);
    const {id:oldId,actualizado,creado,...fields}=raw;
    prepared.push({id,current,patch:{...fields,[idField]:id}});
  }
  const saved=[];let changed=false;
  for(const {id,current,patch}of prepared){
    if(current&&Object.entries(patch).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v))){saved.push(current);continue;}
    saved.push(await db.patch(collection,id,changedFieldsV1(current,{...patch,actualizado:new Date().toISOString()}),{mustExist:!!current,newDocument:!current}));
    changed=true;
  }
  for(const [id]of byId)if(!used.has(id)){await db.delete(collection,id);changed=true;}
  Object.defineProperty(saved,"changed",{value:changed});
  return saved;
}
return {patchChildRowsV1};
})();

// reconstruccion/worker/modules/actividades-v3.js
var text61 = (v) => String(v ?? "").trim();
var bool16 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text61(v).toLowerCase());
var id3 = (p) => p + "-" + crypto.randomUUID();
function today2() {
  return new Date(Date.now() - 3 * 60 * 60 * 1e3).toISOString().slice(0, 10);
}
function addDays2(iso, n) {
  const d = /* @__PURE__ */ new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}
function quota4(admin) {
  const cfg = admin && admin.funcionalidades_config && admin.funcionalidades_config.ACTIVIDADES || {};
  for (const v of [cfg.cantidad, cfg.cupo, cfg.max, cfg.maximo, admin && admin.actividades_cant]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}
function enabled2(admin) {
  if (bool16(admin && admin.actividades)) return true;
  const raw = Array.isArray(admin && admin.funcionalidades) ? admin.funcionalidades : text61(admin && admin.funcionalidades).split(/[;,|\n]/);
  return raw.map((x) => text61(x).toUpperCase()).includes("ACTIVIDADES");
}
async function validateHorario({ db, cache, advertiserId, h }) {
  const city = text61(h && h.ciudad_id);
  if (!city) throw new Error("Cada horario necesita ciudad.");
  const territory = await cache.get("territorio:public:v1");
  if (!territory || (territory.ciudades || []).every((c) => text61(c.ciudad_id || c.id) !== city)) {
    throw new Error("Hay un horario con ciudad inexistente.");
  }
  const type = text61(h.tipo_lugar).toUpperCase();
  const virtual = type.includes("VIRTUAL") || type.includes("ONLINE");
  if (virtual) {
    if (!text61(h.url_virtual || h.link_virtual || h.enlace_virtual || h.web || h.maps)) {
      throw new Error("La actividad virtual necesita enlace o plataforma.");
    }
    return;
  }
  if (text61(h.sede_id)) {
    const sede = await db.get("anunciantes_sedes", text61(h.sede_id));
    if (!sede || text61(sede.anunciante_id) !== text61(advertiserId) || text61(sede.ciudad_id) !== city) {
      throw new Error("La sede no corresponde al anunciante/ciudad.");
    }
    return;
  }
  if (text61(h.lugar_id)) {
    const lugar = await db.get("lugares", text61(h.lugar_id));
    if (!lugar || text61(lugar.ciudad_id) !== city) throw new Error("El lugar no corresponde a la ciudad.");
    return;
  }
  if (!text61(h.lugar_texto) || !text61(h.direccion)) {
    throw new Error("El lugar físico necesita nombre y dirección.");
  }
}
async function activitySaveV3({ db, cache, advertiserId, body }) {
  const admin = await db.get("anunciantes_administracion", advertiserId);
  if (!admin || !enabled2(admin)) throw new Error("No tenés habilitado el módulo Actividades.");
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : {};
  let activityId = text61(payload.actividad_id);
  let current = null;
  const max = quota4(admin), totalMax = limiteGuardadasV62(admin,"ACTIVIDADES",max);
  if (activityId) {
    current = await db.get("actividades", activityId);
    if (!current || text61(current.anunciante_id) !== text61(advertiserId)) throw new Error("Actividad no encontrada.");
  } else {
    const own = await db.queryEqual("actividades", "anunciante_id", advertiserId, 500);
    const active4 = own.filter((a) => bool16(a.activo) && text61(a.estado).toUpperCase() !== "PAUSADA").length;
    if (max <= 0) throw new Error("actividades_sin_cupo");
    if (own.length >= totalMax) throw new Error("actividades_maximo_guardadas");
    if (active4 >= max) throw new Error("actividades_cupo_activo_completo");
    activityId = id3("ACT");
  }
  const oldSchedules = current ? Array.isArray(payload.horarios) ? await db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) : await getPreparedRelationsV1({ cache, type: "activity", id: activityId, current, load: () => db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) }) : [];
  const horarios = Array.isArray(payload.horarios) ? payload.horarios : [];
  const scheduleIds = horarios.map((h) => text61(h?.actividad_horario_id || h?.id)).filter(Boolean);
  if (new Set(scheduleIds).size !== scheduleIds.length) throw new Error("Horario repetido en la operación.");
  for (const [i, h] of horarios.entries()) {
    const requested = text61(h.actividad_horario_id || h.id);
    const previous = requested ? oldSchedules.find((p) => text61(p.actividad_horario_id || p.id) === requested) : oldSchedules[i];
    const placeKeys = ["ciudad_id", "tipo_lugar", "sede_id", "lugar_id", "lugar_texto", "direccion", "maps", "url_virtual", "link_virtual", "enlace_virtual", "web"];
    if (previous && placeKeys.every((k) => text61(previous[k]) === text61(h[k]))) continue;
    await validateHorario({ db, cache, advertiserId, h });
  }
  const previousCities = [...new Set(oldSchedules.map((h) => text61(h.ciudad_id)).filter(Boolean))];
  const hoy = today2(), now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    ...current || {},
    ...payload,
    actividad_id: activityId,
    anunciante_id: advertiserId,
    aprobado: current ? bool16(current.aprobado) : false,
    activo: current ? bool16(current.activo) : true,
    estado: current ? text61(current.estado || "ACTIVA") : "PENDIENTE",
    vigente_desde: current ? text61(current.vigente_desde || hoy) : hoy,
    vigente_hasta: current ? text61(current.vigente_hasta || addDays2(hoy, 30)) : addDays2(hoy, 30),
    creado: current ? text61(current.creado || now) : now,
    actualizado: now
  };
  delete doc.horarios;
  if (!text61(doc.nombre)) throw new Error("Falta nombre de la actividad.");
  if (!text61(doc.categoria)) throw new Error("Falta categoría.");
  let savedHorarios = oldSchedules;
  if (Array.isArray(payload.horarios)) {
    savedHorarios = await patchChildRowsV1({
      db,
      collection: "actividad_horarios",
      idField: "actividad_horario_id",
      prefix: "AH",
      previous: oldSchedules,
      desired: horarios.map((h) => ({ ...h, actividad_id: activityId, ciudad_id: text61(h.ciudad_id), sede_id: text61(h.sede_id), lugar_id: text61(h.lugar_id), lugar_texto: text61(h.lugar_texto), direccion: text61(h.direccion), maps: text61(h.maps), activo: h.activo === void 0 ? true : bool16(h.activo) }))
    });
  }
  const fields = Object.keys(payload).filter((k) => !["id", "actividad_id", "anunciante_id", "horarios", "aprobado", "activo", "estado", "vigente_desde", "vigente_hasta", "creado"].includes(k));
  const patch = changedFieldsV1(current, doc, { touch: !!savedHorarios.changed, fields: current ? fields : null });
  const saved = Object.keys(patch).length ? await db.patch("actividades", activityId, patch, { mustExist: !!current, newDocument: !current }) : current;
  await syncActivityPreparedV2({
    cache,
    activityId,
    current,
    next: saved,
    horarios: savedHorarios,
    previousCities
  });
  return {
    success: true,
    actividad_id: activityId,
    actividad: { ...saved, horarios: savedHorarios },
    created: !current,
    updated: !!current
  };
}
async function activityActionV3({ db, cache, advertiserId, action, activityId }) {
  if (!["eliminar", "pausar", "reanudar", "renovar"].includes(action)) throw new Error("Acción de actividad inválida.");
  const current = await db.get("actividades", activityId);
  if (!current || text61(current.anunciante_id) !== text61(advertiserId)) throw new Error("Actividad no encontrada.");
  if (action === "reanudar" || action === "renovar") {
    const admin = await db.get("anunciantes_administracion", advertiserId);
    if (!admin || !enabled2(admin)) throw new Error("No tenés habilitado el módulo Actividades.");
    const own = await db.queryEqual("actividades", "anunciante_id", advertiserId, 500);
    const active4 = own.filter((a) => text61(a.actividad_id || a.id) !== text61(activityId) && bool16(a.activo) && text61(a.estado).toUpperCase() !== "PAUSADA").length;
    const max = quota4(admin);
    if (max <= 0 || active4 >= max) throw new Error("actividades_cupo_activo_completo");
  }
  const hs = action === "eliminar" ? await db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) : await getPreparedRelationsV1({ cache, type: "activity", id: activityId, current, load: () => db.queryEqual("actividad_horarios", "actividad_id", activityId, 500) });
  const cities = [...new Set(hs.map((h) => text61(h.ciudad_id)).filter(Boolean))];
  if (action === "eliminar") {
    for (const h of hs) {
      const hid = text61(h.actividad_horario_id || h.id);
      if (hid) await db.delete("actividad_horarios", hid);
    }
    await db.delete("actividades", activityId, { mustExist: true });
    await syncActivityPreparedV2({ cache, activityId, current, next: null, horarios: [], previousCities: cities });
    return { success: true, deleted: true, actividad_id: activityId };
  }
  const patch = { actualizado: (/* @__PURE__ */ new Date()).toISOString() };
  if (action === "pausar") {
    patch.activo = false;
    patch.estado = "PAUSADA";
  }
  if (action === "reanudar" || action === "renovar") {
    patch.activo = true;
    patch.estado = "ACTIVA";
    if (action === "renovar") {
      patch.vigente_desde = today2();
      patch.vigente_hasta = addDays2(today2(), 30);
    }
  }
  const delta = changedFieldsV1(current, patch);
  if (!Object.keys(delta).length) return { success: true, updated: false, actividad_id: activityId, actividad: { ...current, horarios: hs } };
  const saved = await db.patch("actividades", activityId, delta, { mustExist: true });
  await syncActivityPreparedV2({
    cache,
    activityId,
    current,
    next: saved,
    horarios: hs,
    previousCities: cities
  });
  return {
    success: true,
    actividad_id: activityId,
    actividad: { ...saved, horarios: hs }
  };
}

// reconstruccion/worker/routes/panel-v12.js
var text62 = (v) => String(v ?? "").trim();
async function bodyOf10(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf6(url, b = {}) {
  return text62(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf6(url, b = {}) {
  return text62(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function routePanelV12(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/actividades" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf10(clone);
    const action = actionOf6(url, body);
    if (["guardar", "renovar", "pausar", "reanudar", "eliminar"].includes(action)) {
      const aid = aidOf6(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "actividades", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Actividades." }, 403);
      }
      if (action === "guardar") {
        return json(await activitySaveV3({ db, cache, advertiserId: aid, body }));
      }
      return json(await activityActionV3({
        db,
        cache,
        advertiserId: aid,
        action,
        activityId: text62(body.actividad_id || body.id || body.payload && (body.payload.actividad_id || body.payload.id))
      }));
    }
  }
  return routePanelV11(ctx);
}

// reconstruccion/worker/modules/publicidad-v4.js
var {publicitySaveV4,publicityActiveChangeV4,publicityDeleteSafeV4} = (() => {

const text=v=>String(v??"").trim();

function parseCategoriaKey(value){
  const raw=text(value);
  const idx=raw.indexOf(":");
  if(idx>0)return{categoria_key:raw,ubicacion_id:raw.slice(0,idx),categoria_id:raw.slice(idx+1)};
  return{categoria_key:raw,ubicacion_id:"",categoria_id:raw};
}
function dateKeyArgentina(){
  return new Date(Date.now()-3*60*60*1000).toISOString().slice(0,10);
}

async function publicitySaveV4({db,cache,advertiserId,body,config={guardadas_max:undefined,prioridad_id:undefined}}){
  const data=body&&body.payload&&typeof body.payload==="object"?body.payload:{};
  const id=text(data.publicidad_id)||("PUB-"+crypto.randomUUID());
  const current=text(data.publicidad_id)?await db.get("publicidades",id):null;
  if(text(data.publicidad_id)&&!current)throw new Error("Publicidad no encontrada.");
  if(current&&text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  if(!current){
    const own=await db.queryEqual("publicidades","anunciante_id",advertiserId,500);
    const max=Number(config.guardadas_max||0);
    if(max<=0||own.length>=max)throw new Error("publicidades_maximo_guardadas");
  }

  const hasSeg=Array.isArray(data.ciudades)||Array.isArray(data.categorias);
  const previousSeg=current?(hasSeg?await db.queryEqual("publicidad_segmentacion","publicidad_id",id,500):
    await getPreparedRelationsV1({cache,type:"publicity-seg",id,current,load:()=>db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)})):[];
  const previousCities=[...new Set(previousSeg.map(x=>text(x.ciudad_id)).filter(Boolean))];
  const now=new Date().toISOString();

  const doc={
    ...(current||{}),
    publicidad_id:id,
    anunciante_id:advertiserId,
    nombre_interno:text(data.nombre_interno??current?.nombre_interno),
    titulo:text(data.titulo??current?.titulo),
    formato:text(data.formato??current?.formato).toUpperCase(),
    cta_texto:text(data.cta_texto??current?.cta_texto),
    cta_tipo:text(data.cta_tipo??current?.cta_tipo).toUpperCase(),
    cta_destino:text(data.cta_destino??current?.cta_destino),
    aprobado:current?current.aprobado:true,
    estado:current?text(current.estado):"INACTIVA",
    vigente_desde:current?text(current.vigente_desde):"",
    vigente_hasta:current?text(current.vigente_hasta):"",
    creado:current?text(current.creado):now,
    actualizado:now
  };
  if(!doc.titulo)throw new Error("Falta título de publicidad.");
  if(!current&&db.prepareNewPanelList)await Promise.all([
    db.prepareNewPanelList('publicidad_media','publicidad_id',id),
    db.prepareNewPanelList('publicidad_segmentacion','publicidad_id',id)
  ]);

  let media=current?(Array.isArray(data.media)?await db.queryEqual("publicidad_media","publicidad_id",id,500):
    await getPreparedRelationsV1({cache,type:"publicity-media",id,current,load:()=>db.queryEqual("publicidad_media","publicidad_id",id,500)})):[];
  if(Array.isArray(data.media)){
    media=await patchChildRowsV1({db,collection:'publicidad_media',idField:'media_id',prefix:'MED',previous:media,
      desired:data.media.filter(m=>text(m?.url)).map((m,i)=>({publicidad_id:id,tipo_media:text(data.formato||doc.formato).toUpperCase(),url:text(m.url),poster:text(m.poster),orden:i+1,activo:true}))});
  }
  let segmentacion=previousSeg;
  if(Array.isArray(data.ciudades)||Array.isArray(data.categorias)){
    const cities=Array.isArray(data.ciudades)?[...new Set(data.ciudades.map(text).filter(Boolean))]:previousCities;
    const cats=Array.isArray(data.categorias)?[...new Set(data.categorias.map(text).filter(Boolean))]:[...new Set(previousSeg.map(x=>text(x.categoria_key)||text(x.ubicacion_id)+':'+text(x.categoria_id)))];
    const desired=[];
    for(const city of cities)for(const raw of cats){
      const cat=parseCategoriaKey(raw);if(!cat.ubicacion_id||!cat.categoria_id)continue;
      desired.push({publicidad_id:id,ciudad_id:city,...cat,prioridad_id:text(config.prioridad_id).toUpperCase(),activo:true});
    }
    segmentacion=await patchChildRowsV1({db,collection:'publicidad_segmentacion',idField:'segmentacion_id',prefix:'SEG',previous:previousSeg,desired,
      matchKey:r=>[r.ciudad_id,r.ubicacion_id,r.categoria_id].join('|')});
  }
  const fields=["nombre_interno","titulo","formato","cta_texto","cta_tipo","cta_destino"].filter(k=>Object.prototype.hasOwnProperty.call(data,k));
  const patch=changedFieldsV1(current,doc,{touch:!!media.changed||!!segmentacion.changed,fields:current?fields:null});
  const saved=Object.keys(patch).length?await db.patch("publicidades",id,patch,{mustExist:!!current,newDocument:!current}):current;

  await syncPublicityPreparedV2({
    cache,
    publicityId:id,
    current,
    next:saved,
    segmentacion,
    media,
    previousCities
  });

  return{
    success:true,
    publicidad_id:id,
    created:!current,
    updated:!!current,
    publicidad:{...saved,media,segmentacion}
  };
}

async function publicityActiveChangeV4({db,cache,advertiserId,ids,configFromAdmin}){
  const [admin,own]=await Promise.all([
    db.get("anunciantes_administracion",advertiserId),
    db.queryEqual("publicidades","anunciante_id",advertiserId,500)
  ]);
  if(!admin)throw new Error("No existe la administración del anunciante.");

  const cfg=configFromAdmin(admin);
  const selected=[...new Set((Array.isArray(ids)?ids:[]).map(text).filter(Boolean))];
  if(cfg.activas_max<=0)throw new Error("sin_cupo_publicidades_activas");
  if(selected.length>cfg.activas_max)throw new Error("supera_publicidades_activas_max");

  const ownIds=new Set(own.map(p=>text(p.publicidad_id||p.id)).filter(Boolean));
  if(selected.some(id=>!ownIds.has(id)))throw new Error("publicidad_no_pertenece_al_anunciante");

  const currentIds=own.filter(p=>text(p.estado).toUpperCase()==="ACTIVA").map(p=>text(p.publicidad_id||p.id)).sort();
  const nextIds=[...selected].sort();
  if(JSON.stringify(currentIds)===JSON.stringify(nextIds)){
    return{success:true,sin_cambios:true,publicidades:own};
  }

  const fecha=dateKeyArgentina(),changeId=advertiserId+"_"+fecha;
  const change=await db.get("publicidad_cambios",changeId);
  const usados=Number(change&&change.usados||0);
  if(cfg.cambios_activos_por_dia_max<=0||usados>=cfg.cambios_activos_por_dia_max){
    throw new Error("cambio_activos_diario_agotado");
  }

  const changed=[],now=new Date().toISOString();
  for(const p of own){
    const id=text(p.publicidad_id||p.id);
    const should=selected.includes(id);
    const is=text(p.estado).toUpperCase()==="ACTIVA";
    if(is===should)continue;

    const [seg,media]=await Promise.all([
      getPreparedRelationsV1({cache,type:"publicity-seg",id,current:p,load:()=>db.queryEqual("publicidad_segmentacion","publicidad_id",id,500)}),
      getPreparedRelationsV1({cache,type:"publicity-media",id,current:p,load:()=>db.queryEqual("publicidad_media","publicidad_id",id,500)})
    ]);
    const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];
    const saved=await db.patch("publicidades",id,{estado:should?"ACTIVA":"INACTIVA",actualizado:now},{mustExist:true});

    await syncPublicityPreparedV2({
      cache,
      publicityId:id,
      current:p,
      next:saved,
      segmentacion:seg,
      media,
      previousCities:cities
    });

    changed.push({...saved,media,segmentacion:seg});
  }

  await db.patch("publicidad_cambios",changeId,{
    cambio_id:changeId,
    anunciante_id:advertiserId,
    fecha,
    usados:usados+1,
    actualizado:now
  });

  const changedMap=new Map(changed.map(x=>[text(x.publicidad_id||x.id),x]));
  const result=own.map(p=>changedMap.get(text(p.publicidad_id||p.id))||p);

  return{
    success:true,
    sin_cambios:false,
    cambios:changed.length,
    publicidades:result,
    cambios_activos:{usados:usados+1,max:cfg.cambios_activos_por_dia_max,disponibles:Math.max(0,cfg.cambios_activos_por_dia_max-(usados+1))}
  };
}

async function publicityDeleteSafeV4({db,cache,advertiserId,publicityId}){
  const id=text(publicityId);
  if(!id)throw new Error("Falta publicidad_id.");

  const current=await db.get("publicidades",id);
  if(!current||text(current.anunciante_id)!==text(advertiserId))throw new Error("La publicidad no pertenece al anunciante.");
  if(text(current.estado).toUpperCase()==="ACTIVA")throw new Error("publicidad_activa_no_eliminable");

  const [seg,media]=await Promise.all([
    db.queryEqual("publicidad_segmentacion","publicidad_id",id,500),
    db.queryEqual("publicidad_media","publicidad_id",id,500)
  ]);
  const cities=[...new Set(seg.map(x=>text(x.ciudad_id)).filter(Boolean))];

  for(const x of seg){
    const xid=text(x.segmentacion_id||x.id);
    if(xid)await db.delete("publicidad_segmentacion",xid);
  }
  for(const x of media){
    const xid=text(x.media_id||x.id);
    if(xid)await db.delete("publicidad_media",xid);
  }

  await db.delete("publicidades",id,{mustExist:true});
  await syncPublicityPreparedV2({
    cache,
    publicityId:id,
    current,
    next:null,
    segmentacion:[],
    media:[],
    previousCities:cities
  });

  return{success:true,deleted:true,publicidad_id:id};
}
return {publicitySaveV4,publicityActiveChangeV4,publicityDeleteSafeV4};
})();

// reconstruccion/worker/routes/panel-v13.js
var text64 = (v) => String(v ?? "").trim();
async function bodyOf11(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf7(url, b = {}) {
  return text64(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf7(url, b = {}) {
  return text64(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
async function routePanelV13(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/publicidad" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf11(clone);
    const action = actionOf7(url, body);
    if (["guardar", "actualizar_activos", "eliminar"].includes(action)) {
      const aid = aidOf7(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "publicidad", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Publicidad." }, 403);
      }
      if (action === "guardar") {
        const admin = await db.get("anunciantes_administracion", aid);
        const cfg = configFromAdmin(admin || {});
        return json(await publicitySaveV4({
          db,
          cache,
          advertiserId: aid,
          body,
          config: cfg
        }));
      }
      if (action === "actualizar_activos") {
        return json(await publicityActiveChangeV4({
          db,
          cache,
          advertiserId: aid,
          ids: Array.isArray(body.publicidad_ids) ? body.publicidad_ids : [],
          configFromAdmin
        }));
      }
      if (action === "eliminar") {
        return json(await publicityDeleteSafeV4({
          db,
          cache,
          advertiserId: aid,
          publicityId: text64(body.publicidad_id)
        }));
      }
    }
  }
  return routePanelV12(ctx);
}

// reconstruccion/worker/modules/efemerides-v3.js
var text65 = (v) => String(v ?? "").trim();
var bool17 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x"].includes(text65(v).toLowerCase());
var norm12 = (v) => text65(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function sanitize2(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const out2 = {
    efemeride_id: text65(p.efemeride_id || p.id),
    tipo: text65(p.tipo).toUpperCase(),
    provincia_id: text65(p.provincia_id),
    ciudad_id: text65(p.ciudad_id),
    tipo_fecha: norm12(p.tipo_fecha),
    nombre: text65(p.nombre),
    descripcion: String(p.descripcion || ""),
    imagen: String(p.imagen || ""),
    activo: p.activo === void 0 ? true : bool17(p.activo),
    origen: text65(p.origen || "WORKER_FIRESTORE")
  };
  if (out2.tipo_fecha === "FIJA") {
    let mes = Number(p.mes || 0), dia = Number(p.dia || 0);
    if ((!mes || !dia) && p.fecha) {
      const m = String(p.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        mes = Number(m[2]);
        dia = Number(m[3]);
      }
    }
    out2.mes = mes;
    out2.dia = dia;
  }
  if (out2.tipo_fecha === "MOVIL") {
    out2.mes = Number(p.mes || 0);
    out2.semana_mes = norm12(p.semana_mes) === "ULTIMA" ? "ULTIMA" : Number(p.semana_mes || 0);
    out2.dia_semana = norm12(p.dia_semana);
  }
  return out2;
}
function validate2(d) {
  if (!d.tipo) return "Falta tipo";
  if (!d.tipo_fecha) return "Falta tipo_fecha";
  if (!["GENERAL", "PROVINCIAL", "LOCAL"].includes(d.tipo)) return "Tipo de efeméride inválido";
  if (!["FIJA", "MOVIL"].includes(d.tipo_fecha)) return "Tipo de fecha inválido";
  if (!d.nombre) return "Falta nombre";
  if (d.tipo === "LOCAL" && !d.ciudad_id) return "Falta ciudad_id";
  if (d.tipo === "PROVINCIAL" && !d.provincia_id) return "Falta provincia_id";
  if (d.tipo_fecha === "FIJA" && (!d.mes || !d.dia)) return "Faltan mes/dia";
  if (d.tipo_fecha === "MOVIL" && (!d.mes || !d.semana_mes || !d.dia_semana)) return "Faltan datos de fecha móvil";
  if (!Number.isInteger(d.mes) || d.mes < 1 || d.mes > 12) return "Mes inválido";
  if (d.tipo_fecha === "FIJA") {
    const max = new Date(Date.UTC(2e3, d.mes, 0)).getUTCDate();
    if (!Number.isInteger(d.dia) || d.dia < 1 || d.dia > max) return "Día inválido";
  }
  if (d.tipo_fecha === "MOVIL") {
    if (d.semana_mes !== "ULTIMA" && (!Number.isInteger(d.semana_mes) || d.semana_mes < 1 || d.semana_mes > 5)) return "Semana inválida";
    if (!["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "0", "1", "2", "3", "4", "5", "6"].includes(d.dia_semana)) return "Día de semana inválido";
  }
  return "";
}
function canSee2(row, p) {
  const tipo = text65(row.tipo).toUpperCase();
  if (tipo === "GENERAL") return !!p.efemerides_grl;
  if (tipo === "PROVINCIAL") return !!p.efemerides_provincial && (p.todas_provincias || p.provincias.includes(text65(row.provincia_id)));
  if (tipo === "LOCAL") return !!p.efemerides_local && (p.todas_ciudades || p.ciudades.includes(text65(row.ciudad_id)));
  return false;
}
async function efemSaveV3({ db, cache, advertiserId, body, permisos }) {
  const payload = body && body.payload && typeof body.payload === "object" ? body.payload : body || {};
  const reqId = text65(payload.efemeride_id || payload.id);
  const existing = reqId ? await db.get("efemerides_bis", reqId) : null;
  if (reqId && !existing) throw new Error("Efeméride no encontrada");
  if (existing && !canSee2(existing, permisos)) throw new Error("No autorizado para esta efeméride");
  const merged = existing ? { ...existing, ...payload, efemeride_id: reqId } : payload;
  const data = sanitize2(merged), err = validate2(data);
  if (err) throw new Error(err);
  if (!canSee2(data, permisos)) throw new Error("No autorizado para esta efeméride");
  const id4 = reqId || "EFE-" + crypto.randomUUID();
  data.efemeride_id = id4;
  data.actualizado_en = (/* @__PURE__ */ new Date()).toISOString();
  if (!existing) {
    data.creado_en = data.actualizado_en;
    data.creado_por = advertiserId;
  } else {
    if (existing.creado_en) data.creado_en = existing.creado_en;
    if (existing.creado_por) data.creado_por = existing.creado_por;
  }
  const fields = Object.keys(payload).filter((k) => !["id", "efemeride_id", "creado_en", "creado_por"].includes(k));
  if (Object.prototype.hasOwnProperty.call(payload, "fecha")) fields.push("mes", "dia");
  const patch = changedFieldsV1(existing, data, { fields: existing ? fields : null });
  const saved = Object.keys(patch).length ? await db.patch("efemerides_bis", id4, patch, { mustExist: !!existing, newDocument: !existing }) : existing;
  await syncEfemeridePreparedV2({ cache, efemerideId: id4, previous: existing, next: saved });
  return { success: true, efemeride: saved };
}
async function efemToggleV3({ db, cache, id: id4, activo, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee2(existing, permisos)) throw new Error("No autorizado");
  const patch = changedFieldsV1(existing, {
    activo: !!activo,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!Object.keys(patch).length) return { success: true, updated: false, efemeride: existing };
  const saved = await db.patch("efemerides_bis", id4, patch, { mustExist: true });
  await syncEfemeridePreparedV2({ cache, efemerideId: id4, previous: existing, next: saved });
  return { success: true, efemeride: saved };
}
async function efemDeleteV3({ db, cache, id: id4, permisos }) {
  const existing = await db.get("efemerides_bis", id4);
  if (!existing) throw new Error("Efeméride no encontrada");
  if (!canSee2(existing, permisos)) throw new Error("No autorizado");
  await db.delete("efemerides_bis", id4, { mustExist: true });
  await syncEfemeridePreparedV2({ cache, efemerideId: id4, previous: existing, next: null });
  return { success: true, deleted: true, efemeride_id: id4 };
}

// reconstruccion/worker/routes/panel-v14.js
var text66 = (v) => String(v ?? "").trim();
var truthy6 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text66(v).toLowerCase());
async function bodyOf12(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf8(url, b = {}) {
  return text66(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf8(url, b = {}) {
  return text66(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
function efemPermisos2(admin){
  const a=admin||{},raw=Array.isArray(a.funcionalidades)?a.funcionalidades:text66(a.funcionalidades).split(/[;,|\n]/);
  const flags=new Set(raw.map(v=>text66(v).toUpperCase()));
  const root=a.funcionalidades_config||{},local=root.EFEMERIDES_LOCAL||{},prov=root.EFEMERIDES_PROVINCIAL||{};
  return {
    efemerides_grl:truthy6(a.efemerides_grl)||flags.has('EF GENERAL')||flags.has('EFEMERIDES_GENERAL')||flags.has('EFEMERIDES_GRL'),
    efemerides_provincial:truthy6(a.efemerides_provincial)||flags.has('EF PROVINCIAL')||flags.has('EFEMERIDES_PROVINCIAL'),
    efemerides_local:truthy6(a.efemerides_local)||flags.has('EF LOCAL')||flags.has('EFEMERIDES_LOCAL'),
    todas_provincias:truthy6(a.efemerides_todas_provincias)||truthy6(prov.todas_provincias),
    todas_ciudades:truthy6(a.efemerides_todas_ciudades)||truthy6(local.todas_ciudades),
    provincias:(Array.isArray(prov.provincias)?prov.provincias:Array.isArray(a.efemerides_provincias)?a.efemerides_provincias:[]).map(text66),
    ciudades:(Array.isArray(local.ciudades)?local.ciudades:Array.isArray(a.efemerides_ciudades)?a.efemerides_ciudades:[]).map(text66)
  };
}

async function routePanelV14(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/efemerides" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf12(clone);
    const action = actionOf8(url, body);
    if (["guardar", "save", "activar", "desactivar", "eliminar", "delete"].includes(action)) {
      const aid = aidOf8(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "efemerides", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Efemérides." }, 403);
      }
      const admin = await db.get("anunciantes_administracion", aid);
      const permisos = efemPermisos2(admin || {});
      if (action === "guardar" || action === "save") {
        return json(await efemSaveV3({ db, cache, advertiserId: aid, body, permisos }));
      }
      const id4 = text66(body.efemeride_id || body.id || body.payload && (body.payload.efemeride_id || body.payload.id));
      if (action === "activar" || action === "desactivar") {
        return json(await efemToggleV3({ db, cache, id: id4, activo: action === "activar", permisos }));
      }
      return json(await efemDeleteV3({ db, cache, id: id4, permisos }));
    }
  }
  return routePanelV13(ctx);
}

// reconstruccion/worker/modules/farmacias-v3.js
var {farmSaveCycleV3} = (() => {

const text=v=>String(v??"").trim();

async function farmSaveCycleV3({db,cache,advertiserId,body,allowedCityIds=[]}){
  const payload=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  let id=text(payload.ciclo_id);
  const current=id?await db.get("farmacias_ciclos",id):null;
  if(id&&!current)throw new Error("Ciclo no encontrado.");

  if(current&&text(current.anunciante_id)&&text(current.anunciante_id)!==text(advertiserId)){
    throw new Error("El ciclo no pertenece al anunciante.");
  }

  const merged={...(current||{}),...payload};
  const city=text(merged.ciudad_id);
  if(!city)throw new Error("Falta ciudad.");
  if(allowedCityIds.length&&!allowedCityIds.includes(city))throw new Error("La ciudad no está habilitada para esta cuenta.");
  if(!text(merged.fecha_inicio))throw new Error("Falta fecha de inicio.");
  if(!text(merged.hora_inicio))throw new Error("Falta hora de inicio.");

  const dur=Math.max(1,Number(merged.duracion_horas||24));
  const simult=Math.max(1,Math.floor(Number(merged.farmacias_por_turno||1)));
  if(!id)id="FAR-"+crypto.randomUUID();

  const previousCity=text(current&&current.ciudad_id);
  const hasParts=Array.isArray(payload.participantes);
  const load=async()=>{
    const participantes=await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500);
    const sedes=[];
    for(const sid of [...new Set(participantes.map(p=>text(p.sede_id)).filter(Boolean))]){
      const sede=await db.get("anunciantes_sedes",sid);if(sede)sedes.push(sede);
    }
    return{participantes,sedes};
  };
  const prepared=current&&!hasParts?await getPreparedRelationsV1({cache,type:"farm",id,current,load}):null;
  let participantes=current?(hasParts?await db.queryEqual("farmacias_ciclo_sedes","ciclo_id",id,500):prepared.participantes):[];
  let sedes=prepared?.sedes||[],participantsChanged=false;

  if(Array.isArray(payload.participantes)){
    const nuevos=payload.participantes.map((p,i)=>({
      ciclo_id:id,
      sede_id:text(p.sede_id),
      orden:Number(p.orden||i+1),
      activo:true,
      actualizado:new Date().toISOString()
    })).filter(p=>p.sede_id);

    if(!nuevos.length)throw new Error("Seleccioná al menos una farmacia.");
    if(new Set(nuevos.map(p=>p.sede_id)).size!==nuevos.length)throw new Error("Farmacia repetida en el ciclo.");
    if(simult>nuevos.length)throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");

    sedes=[];
    for(const p of nuevos){
      const sede=await db.get("anunciantes_sedes",p.sede_id);
      if(!sede)throw new Error("Hay una farmacia/sede inexistente.");
      if(text(sede.ciudad_id)!==city)throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
      sedes.push(sede);
    }

    const existentes=participantes;
    const keep=new Set(nuevos.map(p=>id+"__"+p.sede_id));

    for(const r of existentes){
      const rid=text(r.id||(id+"__"+text(r.sede_id)));
      if(rid&&!keep.has(rid)){await db.delete("farmacias_ciclo_sedes",rid);participantsChanged=true;}
    }

    participantes=[];
    for(const p of nuevos){
      const previous=existentes.find(r=>text(r.sede_id)===p.sede_id);
      const patch=changedFieldsV1(previous,p);
      const saved=Object.keys(patch).length?await db.patch("farmacias_ciclo_sedes",id+"__"+p.sede_id,patch,{mustExist:!!previous,newDocument:!previous}):previous;
      if(Object.keys(patch).length)participantsChanged=true;
      participantes.push(saved);
    }
  }else{
    if(!sameValueV1(current?.ciudad_id,city)){
      sedes=[];
      for(const sid of [...new Set(participantes.map(p=>text(p.sede_id)).filter(Boolean))]){
        const sede=await db.get("anunciantes_sedes",sid);
        if(!sede||text(sede.ciudad_id)!==city)throw new Error("Todas las farmacias deben pertenecer a la ciudad del ciclo.");
        sedes.push(sede);
      }
    }
    if(simult>participantes.length)throw new Error("La cantidad simultánea supera las farmacias seleccionadas.");
  }

  const doc={
    ciclo_id:id,
    anunciante_id:advertiserId,
    ciudad_id:city,
    fecha_inicio:text(merged.fecha_inicio),
    hora_inicio:text(merged.hora_inicio),
    duracion_horas:dur,
    farmacias_por_turno:simult,
    activo:merged.activo===undefined?true:!!merged.activo,
    observaciones:text(merged.observaciones),
    actualizado:new Date().toISOString()
  };
  const fields=Object.keys(payload).filter(k=>!["id","ciclo_id","anunciante_id","participantes"].includes(k));
  if(!current&&db.prepareNewPanelList)await db.prepareNewPanelList('farmacias_ciclo_sedes','ciclo_id',id);
  const patch=changedFieldsV1(current,doc,{touch:participantsChanged,fields:current?fields:null});
  const saved=Object.keys(patch).length?await db.patch("farmacias_ciclos",id,patch,{mustExist:!!current,newDocument:!current}):current;

  await syncFarmCyclePreparedV2({
    cache,
    cycleId:id,
    current,
    next:saved,
    participantes,
    sedes,
    previousCity
  });

  return{
    success:true,
    ciclo_id:id,
    ciclo:{...saved,participantes,sedes}
  };
}
return {farmSaveCycleV3};
})();

// reconstruccion/worker/routes/panel-v15.js
var text68 = (v) => String(v ?? "").trim();
async function bodyOf13(request2) {
  try {
    return await request2.json();
  } catch (_) {
    return {};
  }
}
function actionOf9(url, b = {}) {
  return text68(b.action || b.accion || url.searchParams.get("action")).toLowerCase();
}
function aidOf9(url, b = {}) {
  return text68(b.advertiserId || b.advertiser_id || b.id || b.__id || b.comercio_id || url.searchParams.get("advertiserId") || url.searchParams.get("advertiser_id") || url.searchParams.get("id"));
}
var truthy7 = (v) => v === true || v === 1 || ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text68(v).toLowerCase());
async function allowedFarmCities2({ db, cache, aid }) {
  const admin = await db.get("anunciantes_administracion", aid);
  if (!admin) return [];
  const root = admin.funcionalidades_config && typeof admin.funcionalidades_config === "object" ? admin.funcionalidades_config : {};
  const cfg = root.TURNOS_FARMA || root.FARMACIAS || root.turnos_farma || {};
  const all = truthy7(cfg.todas_ciudades) || text68(admin.turnos_farma) === "*";
  if (all) {
    const territory = await cache.get("territorio:public:v1");
    return (territory && territory.ciudades || []).map((c) => text68(c.ciudad_id || c.id)).filter(Boolean);
  }
  const arr = Array.isArray(cfg.ciudades) ? cfg.ciudades : Array.isArray(admin.farmacias_ciudades) ? admin.farmacias_ciudades : text68(admin.turnos_farma).split(/[;,|]+/).map(text68).filter((v) => v && v !== "*");
  return [...new Set(arr.map(text68).filter(Boolean))];
}
async function routePanelV15(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/farmacias" && request2.method === "POST") {
    const clone = request2.clone();
    const body = await bodyOf13(clone);
    const action = actionOf9(url, body);
    if (action === "guardar_ciclo") {
      const aid = aidOf9(url, body);
      if (!aid) return json({ success: false, message: "Falta advertiserId" }, 400);
      const s = await verifySubscriberSession(env, request2);
      if (!s.ok) return json({ success: false, message: s.message }, 401);
      if (!sessionAllows(s, aid, "turnos_farma", { write: true })) {
        return json({ success: false, message: "No tenés permiso para modificar Farmacias de turno." }, 403);
      }
      return json(await farmSaveCycleV3({
        db,
        cache,
        advertiserId: aid,
        body,
        allowedCityIds: await allowedFarmCities2({ db, cache, aid })
      }));
    }
  }
  return routePanelV14(ctx);
}

// reconstruccion/worker/modules/moderacion-eventos-v2.js
var text69 = (v) => String(v ?? "").trim();
async function pendingEventsV2({ db, limit = 100 }) {
  const rows = await db.queryEqual("eventos", "estado_moderacion", "PENDIENTE", limit);
  return {
    success: true,
    tipo: "EVENTO",
    pendientes: rows.map((e) => ({
      tipo: "EVENTO",
      id: text69(e.evento_id || e.id),
      evento_id: text69(e.evento_id || e.id),
      anunciante_id: text69(e.anunciante_id || e.id_anunciante),
      nombre: text69(e.nombre_evento || e.nombre),
      ciudad_id: text69(e.ciudad_id),
      nivel: text69(e.nivel),
      fecha_desde: text69(e.fecha_desde),
      fecha_hasta: text69(e.fecha_hasta),
      estado_moderacion: text69(e.estado_moderacion)
    }))
  };
}
async function resolveEventModerationV2({ db, cache, eventId, decision, moderatorId }) {
  const id4 = text69(eventId), dec = text69(decision).toUpperCase();
  if (!id4) throw new Error("Falta evento_id.");
  if (!["APROBAR", "RECHAZAR"].includes(dec)) throw new Error("Decisión inválida.");
  const current = await db.get("eventos", id4);
  if (!current) throw new Error("Evento no encontrado.");
  const approved = dec === "APROBAR";
  const saved = await db.patch("eventos", id4, {
    estado_moderacion: approved ? "APROBADO" : "RECHAZADO",
    estado: approved ? "ACTIVO" : "RECHAZADO",
    moderado_por: text69(moderatorId),
    moderado_en: (/* @__PURE__ */ new Date()).toISOString(),
    actualizado: (/* @__PURE__ */ new Date()).toISOString()
  }, { mustExist: true });
  await syncEventV2({ db, cache, current, next: saved });
  return { success: true, tipo: "EVENTO", id: id4, decision: dec, estado_moderacion: saved.estado_moderacion };
}

// reconstruccion/worker/routes/admin-v3.js
var text70 = (v) => String(v ?? "").trim();
async function requireAdmin(env, request2) {
  const a = await verifyAdmin(env, request2);
  return a.ok ? a : null;
}
async function routeAdminV3({ path, request: request2, env, db, cache }) {
  if (!path.startsWith("/superadmin/")) return null;
  if (path === "/superadmin/territory" && request2.method === "GET") return territoryAdmin({ env, request: request2, cache });
  if (path === "/superadmin/territory/rebuild-cache" && request2.method === "POST") return rebuildTerritory({ env, request: request2, db, cache });
  if (path === "/superadmin/countries/create" && request2.method === "POST") return saveCountry({ env, request: request2, db, cache });
  if (path === "/superadmin/provinces/create" && request2.method === "POST") return saveProvince({ env, request: request2, db, cache });
  if (path === "/superadmin/cities/create" && request2.method === "POST") return saveCity({ env, request: request2, db, cache });
  let m = path.match(/^\/superadmin\/countries\/([^/]+)$/);
  if (m && request2.method === "PATCH") return saveCountry({ env, request: request2, db, cache, idFromPath: decodeURIComponent(m[1]) });
  m = path.match(/^\/superadmin\/provinces\/([^/]+)$/);
  if (m && request2.method === "PATCH") return saveProvince({ env, request: request2, db, cache, idFromPath: decodeURIComponent(m[1]) });
  m = path.match(/^\/superadmin\/cities\/([^/]+)$/);
  if (m && request2.method === "PATCH") return saveCity({ env, request: request2, db, cache, idFromPath: decodeURIComponent(m[1]) });
  const a = await requireAdmin(env, request2);
  if (!a) return json({ success: false, message: "Sesión de administrador requerida." }, 401);
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(a.rol)) {
    return json({ success: false, message: "Permiso insuficiente." }, 403);
  }
  if (path === "/superadmin/catalogs/rebuild-cache" && request2.method === "POST") return json(await rebuildCatalogs({ db, cache }));
  if (path === "/superadmin/guide/rebuild-cache" && request2.method === "POST") return json(await rebuildGuideAll({ db, cache }));
  if (path === "/superadmin/promos/rebuild-cache" && request2.method === "POST") return json(await rebuildPromosAll({ db, cache }));
  if (path === "/superadmin/events/rebuild-cache" && request2.method === "POST") return json(await rebuildEventsAllV2({ db, cache }));
  if (path === "/superadmin/activities/rebuild-cache" && request2.method === "POST") return json(await rebuildActivitiesAllV2({ db, cache }));
  if (path === "/superadmin/publicity/rebuild-cache" && request2.method === "POST") return json(await rebuildPublicityAllV2({ db, cache }));
  if (path === "/superadmin/pharmacies/rebuild-cache" && request2.method === "POST") return json(await rebuildFarmAllV2({ db, cache }));
  if (path === "/superadmin/moderation/events/pending" && request2.method === "GET") {
    return json(await pendingEventsV2({ db, limit: 100 }));
  }
  if (path === "/superadmin/moderation/events/resolve" && request2.method === "POST") {
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await resolveEventModerationV2({
      db,
      cache,
      eventId: text70(body.evento_id || body.id),
      decision: text70(body.decision || body.accion),
      moderatorId: a.sid
    }));
  }
  return null;
}

// reconstruccion/worker/core/guide-patch-v2.js
var text71 = (v) => String(v ?? "").trim();
function sortCards4(rows) {
  return [...rows].sort((a, b) => text71(a.nombre).localeCompare(text71(b.nombre), "es", { sensitivity: "base" }));
}
function upsert3(rows, card) {
  const aid = text71(card.id);
  const out2 = (rows || []).filter((x) => text71(x.id) !== aid);
  if (card.aprobado !== false) out2.push(card);
  return sortCards4(out2);
}
async function patchGuideSegmentV2({ cache, advertiserId, segmentoId }) {
  const aid = text71(advertiserId), sid = text71(segmentoId);
  const [base2, catalogs] = await Promise.all([
    cache.get(guideAdvertiserKey(aid)),
    cache.get("catalogs:commerce:v1")
  ]);
  if (!base2 || !Array.isArray(base2.cards)) {
    return { success: true, changed: false, needs_full_sync: true, firestore_reads: 0 };
  }
  const segment = (catalogs && catalogs.segmentos || []).find((s) => text71(s.segmento_id || s.id) === sid) || {};
  const nextCards = base2.cards.map((card) => ({
    ...card,
    segmento_id: sid,
    segmento: text71(segment.nombre)
  }));
  for (const card of nextCards) {
    const cityId = text71(card.ciudad_id);
    const packet2 = await cache.get(guideCityKey2(cityId)) || { version: 2, ciudad_id: cityId, updated_at: "", anunciantes: [] };
    await cache.put(guideCityKey2(cityId), {
      version: 2,
      ciudad_id: cityId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      anunciantes: upsert3(packet2.anunciantes || [], card)
    });
  }
  await cache.put(guideAdvertiserKey(aid), {
    ...base2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    cards: nextCards
  });
  return { success: true, changed: true, ciudades: base2.ciudades || [], firestore_reads: 0 };
}

// reconstruccion/worker/modules/superadmin-anunciantes-v2.js
var text72 = (v) => String(v ?? "").trim();
function isTopAdmin(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text72(auth && auth.rol).toUpperCase());
}
async function updateAdvertiserCommercialV2({ db, cache, auth, advertiserId, payload }) {
  if (!isTopAdmin(auth)) throw new Error("No tenés permiso para modificar la configuración comercial.");
  const aid = text72(advertiserId || payload && payload.anunciante_id || payload && payload.id);
  if (!aid) throw new Error("Falta anunciante_id.");
  const adminPatch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString(), actualizado_por: text72(auth.sid) };
  let adminTouched = false;
  if (Object.prototype.hasOwnProperty.call(payload, "nivel")) {
    const nivel = text72(payload.nivel);
    const catalog=await getCommerceCatalogs(cache);
    const levels=(catalog.niveles_anunciante||[]).filter(x=>x.activo!==false);
    const allowed=levels.length?levels.flatMap(x=>[x.numero,x.nivel_id,x.id].filter(v=>v!==undefined).map(String)):['0','3','4','5'];
    if(!allowed.includes(nivel))throw Error('Elegí un nivel habilitado en la configuración de Gran Hermano.');
    adminPatch.nivel = nivel;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "subnivel")) {
    adminPatch.subnivel = text72(payload.subnivel);
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "aprobado")) {
    adminPatch.aprobado = !!payload.aprobado;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "verificado")) {
    adminPatch.verificado = !!payload.verificado;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "gold")) {
    adminPatch.gold = !!payload.gold;
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "funcionalidades")) {
    adminPatch.funcionalidades = Array.isArray(payload.funcionalidades) ? payload.funcionalidades.map(text72).filter(Boolean) : text72(payload.funcionalidades).split(/[;,|\n]/).map(text72).filter(Boolean);
    adminTouched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "funcionalidades_config")) {
    if (!payload.funcionalidades_config || typeof payload.funcionalidades_config !== "object" || Array.isArray(payload.funcionalidades_config)) {
      throw new Error("La configuración de funcionalidades no es válida.");
    }
    adminPatch.funcionalidades_config = payload.funcionalidades_config;
    adminTouched = true;
  }
  if(adminPatch.funcionalidades_config){
    const numeric=new Set(['cantidad','cupo','max','maximo','activas_max','guardadas_max','cambios_activos_por_dia_max']);
    for(const [name,cfg]of Object.entries(adminPatch.funcionalidades_config)){
      if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))throw Error('Configuración inválida para '+name+'.');
      for(const [key,value]of Object.entries(cfg))if(numeric.has(key)&&(!Number.isSafeInteger(value)||value<0))throw Error('El límite '+name+' debe ser un número entero mayor o igual a cero.');
    }
    const root=adminPatch.funcionalidades_config;
    if(root.TURNOS_FARMA){adminPatch.turnos_farma=root.TURNOS_FARMA.todas_ciudades?'*':(root.TURNOS_FARMA.ciudades||[]).join(',');adminPatch.farmacias_ciudades=root.TURNOS_FARMA.ciudades||[];}
    if(root.EFEMERIDES_LOCAL){adminPatch.efemerides_todas_ciudades=!!root.EFEMERIDES_LOCAL.todas_ciudades;adminPatch.efemerides_ciudades=root.EFEMERIDES_LOCAL.ciudades||[];}
    if(root.EFEMERIDES_PROVINCIAL){adminPatch.efemerides_todas_provincias=!!root.EFEMERIDES_PROVINCIAL.todas_provincias;adminPatch.efemerides_provincias=root.EFEMERIDES_PROVINCIAL.provincias||[];}
  }
  if(adminPatch.funcionalidades){
    const active=new Set(adminPatch.funcionalidades.map(x=>String(x).toUpperCase()));
    const groups={PROMOS:['PROMOS','PROMOCIONES'],EVENTOS:['EVENTOS','EVENTOS_VIP','EVENTOS VIP'],EVENTOS_FREE:['EVENTOS_FREE','EV_FREE','EVFREE','EVENTOS FREE'],ACTIVIDADES:['ACTIVIDADES'],PUBLICIDAD:['PUBLICIDAD'],TURNOS_FARMA:['TURNOS_FARMA','FARMACIAS','TURNOS FARMA'],EFEMERIDES_GRL:['EFEMERIDES_GRL','EFEMERIDES_GENERAL','EF GENERAL'],EFEMERIDES_PROVINCIAL:['EFEMERIDES_PROVINCIAL','EF PROVINCIAL'],EFEMERIDES_LOCAL:['EFEMERIDES_LOCAL','EF LOCAL']};
    for(const [name,aliases]of Object.entries(groups)){
      const enabled=aliases.some(x=>active.has(x));
      for(const alias of aliases)if(alias!=='TURNOS_FARMA')adminPatch[alias.toLowerCase()]=enabled;
      if(name==='TURNOS_FARMA'&&!enabled)adminPatch.turnos_farma='';
    }
  }
  let firestoreWrites = 0;
  if (adminTouched) {
    await db.patch("anunciantes_administracion", aid, adminPatch, { mustExist: true });
    firestoreWrites++;
    await Promise.all([
      patchGuideAdminFieldsV2({ cache, advertiserId: aid, patch: adminPatch }),
      patchAdvertiserIndexCommercialV2({ cache, advertiserId: aid, patch: adminPatch })
    ]);
  }
  let segmentoId = null;
  if (Object.prototype.hasOwnProperty.call(payload, "segmento_id")) {
    segmentoId = text72(payload.segmento_id);
    await db.patch("anunciantes", aid, { segmento_id: segmentoId, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() }, { mustExist: true });
    firestoreWrites++;
    await patchGuideSegmentV2({ cache, advertiserId: aid, segmentoId });
  }
  return {
    success: true,
    updated: true,
    anunciante_id: aid,
    administracion_patch: adminTouched ? adminPatch : {},
    segmento_id: segmentoId,
    firestore_writes: firestoreWrites,
    firestore_reads: 0
  };
}

// reconstruccion/worker/routes/admin-v4.js
var text73 = (v) => String(v ?? "").trim();
async function routeAdminV4(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  let m = path.match(/^\/superadmin\/advertisers\/([^/]+)\/commercial$/);
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await updateAdvertiserCommercialV2({
      db,
      cache,
      auth,
      advertiserId: decodeURIComponent(m[1]),
      payload: body && body.payload && typeof body.payload === "object" ? body.payload : body
    }));
  }
  if (path === "/superadmin/guide/rebuild-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text73(auth.rol).toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildGuideAllV2({ db, cache }));
  }
  return routeAdminV3(ctx);
}

// reconstruccion/worker/modules/superadmin-anunciantes-profile-v2.js
var text74 = (v) => String(v ?? "").trim();
function isTopAdmin2(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text74(auth && auth.rol).toUpperCase());
}
async function updateAdvertiserProfileV2({ db, cache, auth, advertiserId, payload }) {
  if (!isTopAdmin2(auth)) throw new Error("No tenés permiso para modificar los datos del anunciante.");
  const aid = text74(advertiserId);
  if (!aid) throw new Error("Falta anunciante_id.");
  const patch = { actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  let touched = false;
  if (Object.prototype.hasOwnProperty.call(payload, "segmento_id")) {
    patch.segmento_id = text74(payload.segmento_id);
    touched = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "categoria_ids")) {
    patch.categoria_ids = Array.isArray(payload.categoria_ids) ? payload.categoria_ids.map(text74).filter(Boolean) : [];
    touched = true;
  }
  for (const key3 of ["pet", "eco", "gayfriendly"]) {
    if (Object.prototype.hasOwnProperty.call(payload, key3)) {
      patch[key3] = !!payload[key3];
      touched = true;
    }
  }
  if (!touched) return { success: true, updated: false, anunciante_id: aid };
  await db.patch("anunciantes", aid, patch, { mustExist: true });
  await patchGuideAdvertiserDataFromCacheV2({ cache, advertiserId: aid, patch });
  return {
    success: true,
    updated: true,
    anunciante_id: aid,
    firestore_writes: 1
  };
}
async function updateAdvertiserSedeRelationsV2({ db, cache, auth, advertiserId, sedes }) {
  if (!isTopAdmin2(auth)) throw new Error("No tenés permiso para modificar las sedes.");
  const aid = text74(advertiserId);
  if (!aid) throw new Error("Falta anunciante_id.");
  const rows = Array.isArray(sedes) ? sedes : [];
  let writes = 0;
  const prepared = [], seen = /* @__PURE__ */ new Set(), savedSedes = [];
  for (const raw of rows) {
    const sid = text74(raw && raw.sede_id);
    if (!sid) continue;
    if (seen.has(sid)) throw new Error("Sede repetida en la operación.");
    seen.add(sid);
    const current = await db.get("anunciantes_sedes", sid);
    if (!current || text74(current.anunciante_id) !== aid) {
      throw new Error("La sede " + sid + " no pertenece al anunciante.");
    }
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(raw, "actividad_ids")) {
      patch.actividad_ids = Array.isArray(raw.actividad_ids) ? raw.actividad_ids.map(text74).filter(Boolean) : [];
    }
    if (Object.prototype.hasOwnProperty.call(raw, "accion_ids")) {
      patch.accion_ids = Array.isArray(raw.accion_ids) ? raw.accion_ids.map(text74).filter(Boolean) : [];
    }
    if (Object.prototype.hasOwnProperty.call(raw, "nodo_ids")) {
      patch.nodo_ids = Array.isArray(raw.nodo_ids) ? raw.nodo_ids.map(text74).filter(Boolean) : [];
    }
    for (const key3 of Object.keys(patch)) {
      if (JSON.stringify(patch[key3]) === JSON.stringify(current[key3])) delete patch[key3];
    }
    prepared.push({ sid, patch });
  }
  for (const { sid, patch } of prepared) {
    if (!Object.keys(patch).length) continue;
    patch.actualizado_en = (/* @__PURE__ */ new Date()).toISOString();
    savedSedes.push(await db.patch("anunciantes_sedes", sid, patch, { mustExist: true }));
    writes++;
  }
  if (writes) await patchGuideAdvertiserSedesFromCacheV2({ cache, advertiserId: aid, savedSedes });
  return { success: true, updated: !!writes, sedes_actualizadas: writes, firestore_writes: writes };
}

// reconstruccion/worker/routes/admin-v5.js
async function routeAdminV5(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  let m = path.match(/^\/superadmin\/advertisers\/([^/]+)\/profile$/);
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await updateAdvertiserProfileV2({
      db,
      cache,
      auth,
      advertiserId: decodeURIComponent(m[1]),
      payload: body && body.payload && typeof body.payload === "object" ? body.payload : body
    }));
  }
  m = path.match(/^\/superadmin\/advertisers\/([^/]+)\/sedes\/relations$/);
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await updateAdvertiserSedeRelationsV2({
      db,
      cache,
      auth,
      advertiserId: decodeURIComponent(m[1]),
      sedes: Array.isArray(body.sedes) ? body.sedes : []
    }));
  }
  return routeAdminV4(ctx);
}

// reconstruccion/worker/modules/moderacion-general-v2.js
var text75 = (v) => String(v ?? "").trim();
function isRejectedActivity(a) {
  return ["RECHAZADA", "RECHAZADO", "ELIMINADA", "ELIMINADO"].includes(text75(a && a.estado).toUpperCase());
}
async function pendingAllV2({ db }) {
  const [evPend, evRev, activities, requests] = await Promise.all([
    db.queryEqual("eventos", "estado_moderacion", "PENDIENTE", 200),
    db.queryEqual("eventos", "estado_moderacion", "REVISION", 200),
    db.queryEqual("actividades", "aprobado", false, 200),
    db.queryEqual("solicitudes_anunciante", "estado", "PENDIENTE", 200)
  ]);
  const eventos = [...evPend, ...evRev].map((e) => ({
    tipo: "EVENTO",
    id: text75(e.evento_id || e.id),
    evento_id: text75(e.evento_id || e.id),
    nombre: text75(e.nombre_evento || e.nombre),
    ciudad_id: text75(e.ciudad_id),
    anunciante_id: text75(e.anunciante_id || e.id_anunciante),
    nivel: text75(e.nivel),
    estado: text75(e.estado_moderacion || "PENDIENTE"),
    fecha: text75(e.fecha_desde || e.fecha_carga),
    motivo: text75(e.motivo_revision)
  }));
  const actividades = activities.filter((a) => !isRejectedActivity(a)).map((a) => ({
    tipo: "ACTIVIDAD",
    id: text75(a.actividad_id || a.id),
    actividad_id: text75(a.actividad_id || a.id),
    nombre: text75(a.nombre),
    ciudad_id: text75(a.ciudad_id),
    anunciante_id: text75(a.anunciante_id),
    estado: text75(a.estado || "PENDIENTE"),
    fecha: text75(a.creado || a.actualizado)
  }));
  const anunciantes = requests.map((x) => ({
    tipo: "ANUNCIANTE",
    id: text75(x.solicitud_id || x.id),
    solicitud_id: text75(x.solicitud_id || x.id),
    modo: text75(x.modo).toUpperCase(),
    nombre: text75(x.nombre),
    ciudad_id: text75(x.ciudad_id),
    anunciante_id: text75(x.anunciante_id),
    suscriptor_id: text75(x.suscriptor_id),
    estado: "PENDIENTE",
    fecha: text75(x.creado_en),
    detalle: x.detalle || {}
  }));
  return {
    success: true,
    cantidades: {
      eventos: eventos.length,
      actividades: actividades.length,
      anunciantes: anunciantes.length,
      total: eventos.length + actividades.length + anunciantes.length
    },
    eventos,
    actividades,
    anunciantes
  };
}
function newAdvertiserId() {
  return "ADV-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}
async function resolvePendingV2({ db, cache, auth, tipo, id: id4, decision, nivel = "" }) {
  const kind = text75(tipo).toUpperCase();
  const itemId = text75(id4);
  const dec = text75(decision).toUpperCase();
  if (!itemId || !["APROBAR", "RECHAZAR"].includes(dec)) throw new Error("Falta indicar contenido o decisión.");
  if (kind === "EVENTO") {
    return resolveEventModerationV2({
      db,
      cache,
      eventId: itemId,
      decision: dec,
      moderatorId: auth.sid
    });
  }
  if (kind === "ACTIVIDAD") {
    const current = await db.get("actividades", itemId);
    if (!current) throw new Error("Actividad no encontrada.");
    const saved = await db.patch("actividades", itemId, {
      aprobado: dec === "APROBAR",
      estado: dec === "APROBAR" ? "ACTIVA" : "RECHAZADA",
      moderado_por: text75(auth.sid),
      moderado_en: (/* @__PURE__ */ new Date()).toISOString(),
      actualizado: (/* @__PURE__ */ new Date()).toISOString()
    }, { mustExist: true });
    await syncActivity({ db, cache, activityId: itemId, previousCities: [] });
    return { success: true, tipo: kind, id: itemId, decision: dec, estado: saved.estado };
  }
  if (kind === "ANUNCIANTE") {
    const req = await db.get("solicitudes_anunciante", itemId);
    if (!req) throw new Error("Solicitud de anunciante no encontrada.");
    if (text75(req.estado).toUpperCase() !== "PENDIENTE") throw new Error("La solicitud ya fue resuelta.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sid = text75(req.suscriptor_id), modo = text75(req.modo).toUpperCase();
    if (dec === "RECHAZAR") {
      await db.patch("solicitudes_anunciante", itemId, {
        estado: "RECHAZADA",
        moderado_por: text75(auth.sid),
        moderado_en: now,
        actualizado_en: now
      }, { mustExist: true });
      return { success: true, tipo: kind, id: itemId, decision: dec };
    }
    let aid = text75(req.anunciante_id);
    if (modo === "CREAR") {
      const level = text75(nivel);
      if (!level) throw new Error("Seleccioná el nivel del nuevo anunciante.");
      aid = newAdvertiserId();
      const detail = req.detalle || {};
      const city = text75(req.ciudad_id);
      await db.patch("anunciantes", aid, {
        id: aid,
        nombre: text75(req.nombre),
        actividad: text75(detail.actividad),
        descripcion: text75(detail.descripcion),
        whatsapp: text75(detail.whatsapp),
        mail: text75(detail.mail),
        web: text75(detail.web),
        creado_en: now,
        actualizado_en: now
      });
      await db.patch("anunciantes_administracion", aid, {
        id: aid,
        aprobado: true,
        nivel: level,
        subnivel: "0",
        verificado: false,
        gold: false,
        funcionalidades: [],
        creado_en: now,
        actualizado_en: now
      });
      if (city) {
        const sedeId = "SED-" + aid + "-MAIN";
        await db.patch("anunciantes_sedes", sedeId, {
          sede_id: sedeId,
          anunciante_id: aid,
          ciudad_id: city,
          nombre_sede: "Principal",
          direccion: text75(detail.direccion),
          whatsapp: text75(detail.whatsapp),
          mail: text75(detail.mail),
          web: text75(detail.web),
          activo: true,
          creado_en: now,
          actualizado_en: now
        });
      }
    } else if (modo === "RECLAMAR") {
      if (!aid || !await db.get("anunciantes", aid)) throw new Error("El anunciante reclamado ya no existe.");
    } else {
      throw new Error("Tipo de solicitud inválido.");
    }
    const relId = sid + "__" + aid;
    await db.patch("suscriptor_anunciante", relId, {
      relacion_id: relId,
      suscriptor_id: sid,
      anunciante_id: aid,
      rol: "PROPIETARIO",
      activo: true,
      fecha_alta: now,
      actualizado: now
    });
    await db.patch("solicitudes_anunciante", itemId, {
      estado: "APROBADA",
      anunciante_id: aid,
      moderado_por: text75(auth.sid),
      moderado_en: now,
      actualizado_en: now
    }, { mustExist: true });
    if (modo === "CREAR") {
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
    }
    return { success: true, tipo: kind, id: itemId, decision: dec, anunciante_id: aid, suscriptor_id: sid };
  }
  throw new Error("Tipo de contenido no reconocido.");
}

// reconstruccion/worker/routes/admin-v6.js
var text76 = (v) => String(v ?? "").trim();
function canModerate(auth) {
  const role = text76(auth && auth.rol).toUpperCase();
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(role);
}
async function routeAdminV6(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/efemerides/rebuild-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text76(auth.rol).toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildEfemeridesAllV3({ db, cache }));
  }
  if (path === "/superadmin/moderation/pending" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    return json(await pendingAllV2({ db }));
  }
  if (path === "/superadmin/moderation/resolve" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await resolvePendingV2({
      db,
      cache,
      auth,
      tipo: text76(body.tipo),
      id: text76(body.id || body.evento_id || body.actividad_id || body.solicitud_id),
      decision: text76(body.decision),
      nivel: text76(body.nivel)
    }));
  }
  return routeAdminV5(ctx);
}

// reconstruccion/worker/maintenance/rebuild-all-v2.js
async function rebuildAllReadModelsV2({ env, request: request2, db, cache }) {
  const started = (/* @__PURE__ */ new Date()).toISOString();
  const territoryResponse = await rebuildTerritory({ env, request: request2, db, cache });
  const territory = await territoryResponse.clone().json().catch(() => ({ success: false }));
  if (!territoryResponse.ok || territory.success !== true) {
    throw new Error(territory.message || "No se pudo reconstruir Territorio.");
  }
  const catalogs = await rebuildCatalogs({ db, cache });
  const guideReady = rebuildGuideAllV2({ db, cache });
  const [
    guide,
    promos,
    events,
    activities,
    publicity,
    efemerides,
    pharmacies,
    adminIndexes
  ] = await Promise.all([
    guideReady,
    rebuildPromosAll({ db, cache }),
    rebuildEventsAllV2({ db, cache }),
    rebuildActivitiesAllV2({ db, cache }),
    rebuildPublicityAllV2({ db, cache }),
    rebuildEfemeridesAllV3({ db, cache }),
    guideReady.then(() => rebuildFarmAllV2({ db, cache })),
    rebuildAdminIndexesV2({ db, cache })
  ]);
  return {
    success: true,
    started_at: started,
    finished_at: (/* @__PURE__ */ new Date()).toISOString(),
    territory,
    catalogs,
    guide,
    promos,
    events,
    activities,
    publicity,
    efemerides,
    pharmacies,
    adminIndexes
  };
}

// reconstruccion/worker/routes/admin-v7.js
var text77 = (v) => String(v ?? "").trim();
async function routeAdminV7(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/rebuild-all-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text77(auth.rol).toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildAllReadModelsV2({ env, request: request2, db, cache }));
  }
  return routeAdminV6(ctx);
}

// reconstruccion/worker/modules/superadmin-directorio-v2.js
var text78 = (v) => String(v ?? "").trim();
async function adminSearchAdvertisersV2({ cache, url }) {
  return searchAdvertisersV2({
    cache,
    q: text78(url.searchParams.get("q")),
    cityId: text78(url.searchParams.get("ciudad_id")),
    limit: Number(url.searchParams.get("limit") || 100)
  });
}
async function adminSearchSubscribersV2({ cache, url }) {
  return searchSubscribersV2({
    cache,
    q: text78(url.searchParams.get("q")),
    tipo: text78(url.searchParams.get("tipo")),
    limit: Number(url.searchParams.get("limit") || 100)
  });
}
async function adminAdvertiserDetailV2({ db, id: id4 }) {
  return advertiserDetailV2({ db, advertiserId: id4 });
}
async function adminSubscriberDetailV2({ db, id: id4 }) {
  return subscriberDetailV2({ db, subscriberId: id4 });
}

// reconstruccion/worker/routes/admin-v8.js
async function routeAdminV8(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  if (path === "/superadmin/advertisers/search" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminSearchAdvertisersV2({ cache, url }));
  }
  let m = path.match(/^\/superadmin\/advertisers\/([^/]+)$/);
  if (m && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminAdvertiserDetailV2({ db, id: decodeURIComponent(m[1]) }));
  }
  if (path === "/superadmin/subscribers/search" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminSearchSubscribersV2({ cache, url }));
  }
  m = path.match(/^\/superadmin\/subscribers\/([^/]+)$/);
  if (m && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await adminSubscriberDetailV2({ db, id: decodeURIComponent(m[1]) }));
  }
  if (path === "/superadmin/directories/rebuild-cache" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(String(auth.rol || "").trim().toUpperCase())) {
      return json({ success: false, message: "Permiso insuficiente." }, 403);
    }
    return json(await rebuildAdminIndexesV2({ db, cache }));
  }
  return routeAdminV7(ctx);
}

// reconstruccion/worker/modules/superadmin-catalogos-v2.js
var ADMIN_KEY2 = "admin:catalogs:v2";
var text79 = (v) => String(v ?? "").trim();
var defs = {
  segmentos: { collection: "segmentos", idField: "segmento_id", moduleKey: KEYS.commerce, moduleField: "segmentos" },
  niveles_anunciante: { collection: "niveles_anunciante", idField: "nivel_id", moduleKey: KEYS.commerce, moduleField: "niveles_anunciante" },
  funcionalidades: { collection: "funcionalidades", idField: "funcionalidad_id", moduleKey: KEYS.commerce, moduleField: "funcionalidades" },
  categorias: { collection: "categorias", idField: "categoria_id", moduleKey: KEYS.commerce, moduleField: "categorias" },
  actividades_clave: { collection: "actividades_clave", idField: "actividad_id", moduleKey: KEYS.commerce, moduleField: "actividades_clave" },
  acciones: { collection: "acciones", idField: "accion_id", moduleKey: KEYS.commerce, moduleField: "acciones" },
  nodos: { collection: "nodos", idField: "nodo_id", moduleKey: KEYS.commerce, moduleField: "nodos" },
  eventos_categorias: { collection: "eventos_categorias", idField: "categoria_id", moduleKey: KEYS.eventos, moduleField: "categorias" },
  actividades_categorias: { collection: "actividades_categorias", idField: "categoria_id", moduleKey: KEYS.actividades, moduleField: "categorias" },
  moderacion_18: { collection: "eventos_moderacion_palabras", idField: "regla_id", moduleKey: "", moduleField: "" }
};
function active3(x) {
  if (x.activo === void 0 && x.activa === void 0) return true;
  const v = x.activo ?? x.activa;
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "x", "activo", "activa"].includes(text79(v).toLowerCase());
}
function upsert4(rows, idField, item) {
  const id4 = text79(item[idField] || item.id);
  const out2 = (rows || []).filter((x) => text79(x[idField] || x.id) !== id4);
  out2.push(item);
  return out2;
}
function sortRows(rows) {
  return [...rows || []].sort((a, b) => {
    const ao = Number(a.orden ?? a.prioridad ?? a.numero ?? 999999);
    const bo = Number(b.orden ?? b.prioridad ?? b.numero ?? 999999);
    if (ao !== bo) return ao - bo;
    return text79(a.nombre).localeCompare(text79(b.nombre), "es", { sensitivity: "base" });
  });
}
async function listAdminCatalogV2({ cache, tipo, cityId = "" }) {
  const t = text79(tipo).toLowerCase(), def = defs[t];
  if (!def) return { success: false, message: "Catálogo no reconocido." };
  const packet2 = await cache.get(ADMIN_KEY2) || {};
  let rows = Array.isArray(packet2[t]) ? packet2[t] : [];
  if (t === "nodos" && text79(cityId)) {
    rows = rows.filter((x) => text79(x.ciudad_id) === text79(cityId));
  }
  return { success: true, tipo: t, results: sortRows(rows), source: "kv" };
}
async function saveAdminCatalogV2({ db, cache, tipo, item, cityId = "" }) {
  const t = text79(tipo).toLowerCase(), def = defs[t];
  if (!def) throw new Error("Catálogo no reconocido.");
  if (!item || typeof item !== "object") throw new Error("Item inválido.");
  const id4 = text79(item[def.idField] || item.id);
  if (!id4) throw new Error("Falta " + def.idField + ".");
  const payload = { ...item, [def.idField]: id4, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() };
  if (t === "nodos" && cityId && !text79(payload.ciudad_id)) payload.ciudad_id = text79(cityId);
  const admin = await cache.get(ADMIN_KEY2) || { version: 2 };
  const current = (admin[t] || []).find((x) => text79(x[def.idField] || x.id) === id4);
  const patch = changedFieldsV1(current, payload);
  if (!Object.keys(patch).length) return { success: true, updated: false, tipo: t, item: current, firestore_writes: 0, firestore_reads: 0 };
  const saved = await db.patch(def.collection, id4, patch, { mustExist: !!current, newDocument: !current });
  const adminRows = upsert4(Array.isArray(admin[t]) ? admin[t] : [], def.idField, saved);
  await cache.put(ADMIN_KEY2, {
    ...admin,
    version: 2,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    [t]: adminRows
  });
  if (def.moduleKey && def.moduleField) {
    const modulePacket = await cache.get(def.moduleKey) || {};
    let rows = (Array.isArray(modulePacket[def.moduleField]) ? modulePacket[def.moduleField] : []).filter((x) => text79(x[def.idField] || x.id) !== id4);
    if (active3(saved)) rows.push(saved);
    await cache.put(def.moduleKey, {
      ...modulePacket,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      [def.moduleField]: sortRows(rows)
    });
  }
  return {
    success: true,
    tipo: t,
    item: saved,
    firestore_writes: 1,
    firestore_reads: 0
  };
}

// reconstruccion/worker/routes/admin-v9.js
var text80 = (v) => String(v ?? "").trim();
function canManageCatalogs(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN"].includes(text80(auth && auth.rol).toUpperCase());
}
async function routeAdminV9(ctx) {
  const { path, request: request2, url, env, db, cache } = ctx;
  let m = path.match(/^\/superadmin\/catalogs\/([^/]+)$/);
  if (m && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await listAdminCatalogV2({
      cache,
      tipo: decodeURIComponent(m[1]),
      cityId: text80(url.searchParams.get("ciudad_id"))
    }));
  }
  if (m && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canManageCatalogs(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await saveAdminCatalogV2({
      db,
      cache,
      tipo: decodeURIComponent(m[1]),
      item: body && body.item && typeof body.item === "object" ? body.item : body,
      cityId: text80(body.ciudad_id || url.searchParams.get("ciudad_id"))
    }));
  }
  return routeAdminV8(ctx);
}

// reconstruccion/worker/modules/superadmin-session-v2.js
var text81 = (v) => String(v ?? "").trim();
var norm13 = (v) => text81(v).toLowerCase();
function b644(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((x) => binary += String.fromCharCode(x));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function hmac4(env, value) {
  const secret = text81(env.SERVER_SECRET);
  if (!secret) throw new Error("Falta SERVER_SECRET");
  const key3 = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key3, new TextEncoder().encode(value));
  return b644(new Uint8Array(sig));
}
async function issue2(env, payload) {
  const body = b644(JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 8 * 60 * 60 * 1e3
  }));
  return body + "." + await hmac4(env, body);
}
function truthy8(v) {
  if (v === true || v === 1) return true;
  return ["true", "1", "si", "sí", "yes", "x", "activo", "activa"].includes(norm13(v));
}
async function superadminLoginV2({ env, db, body }) {
  const original = text81(body && body.mail);
  const mail = norm13(original);
  const clave = text81(body && body.clave);
  if (!mail || !clave) return { success: false, message: "Falta mail o clave" };
  let rows = await db.queryEqual("suscriptores", "mail", mail, 5);
  if (!rows.length && original && original !== mail) {
    rows = await db.queryEqual("suscriptores", "mail", original, 5);
  }
  const sus = rows.find((a) => norm13(a.mail) === mail);
  if (!sus || text81(sus.clave) !== clave) {
    return { success: false, message: "Mail o clave incorrectos" };
  }
  if (sus.activo !== "" && sus.activo !== null && sus.activo !== void 0 && !truthy8(sus.activo)) {
    return { success: false, message: "Suscriptor no activo" };
  }
  const sid = text81(sus.suscriptor_id || sus.id);
  if (!sid) return { success: false, message: "Suscriptor sin ID válido" };
  let admin = await db.get("superadmins", sid);
  if (!admin) {
    const permisos = await db.queryEqual("superadmins", "suscriptor_id", sid, 5);
    admin = permisos.find((a) => text81(a.suscriptor_id) === sid);
  }
  if (!admin) return { success: false, message: "Esta cuenta no tiene acceso a este panel" };
  if (!truthy8(admin.activo)) {
    return { success: false, message: "Administrador no activo" };
  }
  const role = text81(admin.rol || "SUPERADMIN").toUpperCase();
  if (!["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(role)) {
    return { success: false, message: "Esta cuenta no está habilitada para Gran Hermano" };
  }
  const nombre = text81(sus.nombre || admin.nombre);
  const token2 = await issue2(env, { sid, rol: role, nombre, mail: text81(sus.mail) });
  return {
    success: true,
    token: token2,
    admin: {
      id: sid,
      suscriptor_id: sid,
      nombre,
      mail: text81(sus.mail),
      rol: role,
      activo: true,
      ciudades: Array.isArray(admin.ciudades) ? admin.ciudades : [],
      permisos: admin.permisos && typeof admin.permisos === "object" ? admin.permisos : {}
    },
    expires_in_seconds: 8 * 60 * 60
  };
}

// reconstruccion/worker/modules/superadmin-dashboard-v2.js
async function superadminDashboardV2({ cache }) {
  const [adv, sub, territory] = await Promise.all([
    cache.get(ADMIN_ADVERTISERS_KEY),
    cache.get(ADMIN_SUBSCRIBERS_KEY),
    cache.get("territorio:admin:v1")
  ]);
  return {
    success: true,
    resumen: {
      suscriptores: sub && Array.isArray(sub.results) ? sub.results.length : 0,
      anunciantes: adv && Array.isArray(adv.results) ? adv.results.length : 0,
      ciudades: territory && Array.isArray(territory.ciudades) ? territory.ciudades.length : 0
    },
    source: "kv"
  };
}

// reconstruccion/worker/routes/admin-v10.js
async function routeAdminV10(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/session/login" && request2.method === "POST") {
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    const out2 = await superadminLoginV2({ env, db, body });
    return json(out2, out2.success ? 200 : 401);
  }
  if (path === "/superadmin/dashboard" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    return json(await superadminDashboardV2({ cache }));
  }
  return routeAdminV9(ctx);
}

// reconstruccion/worker/modules/moderacion-general-v3.js
var text82 = (v) => String(v ?? "").trim();
function rejectedActivity(a) {
  return ["RECHAZADA", "RECHAZADO", "ELIMINADA", "ELIMINADO"].includes(text82(a && a.estado).toUpperCase());
}
async function pendingAllV3({ db }) {
  if(db.panelReadDb) db=db.panelReadDb();
  const [evPend, evRev, activities, requests] = await Promise.all([
    db.queryEqual("eventos", "estado_moderacion", "PENDIENTE", 500),
    db.queryEqual("eventos", "estado_moderacion", "REVISION", 500),
    db.queryEqual("actividades", "aprobado", false, 500),
    db.queryEqual("solicitudes_anunciante", "estado", "PENDIENTE", 500)
  ]);
  const eventos = [...evPend, ...evRev].map((e) => ({
    ...e,
    tipo: "EVENTO",
    id: text82(e.evento_id || e.id),
    evento_id: text82(e.evento_id || e.id),
    nombre: text82(e.nombre_evento || e.nombre),
    ciudad_id: text82(e.ciudad_id),
    anunciante_id: text82(e.anunciante_id || e.id_anunciante),
    nivel: text82(e.nivel),
    estado: text82(e.estado_moderacion || "PENDIENTE"),
    fecha: text82(e.fecha_desde || e.fecha_carga),
    motivo: text82(e.motivo_revision)
  }));
  const actividades = activities.filter((a) => !rejectedActivity(a)).map((a) => ({
    ...a,
    tipo: "ACTIVIDAD",
    id: text82(a.actividad_id || a.id),
    actividad_id: text82(a.actividad_id || a.id),
    nombre: text82(a.nombre),
    ciudad_id: text82(a.ciudad_id),
    anunciante_id: text82(a.anunciante_id),
    estado: text82(a.estado || "PENDIENTE"),
    fecha: text82(a.creado || a.actualizado)
  }));
  const anunciantes = requests.map((x) => ({
    ...x,
    tipo: "ANUNCIANTE",
    id: text82(x.solicitud_id || x.id),
    solicitud_id: text82(x.solicitud_id || x.id),
    modo: text82(x.modo).toUpperCase(),
    nombre: text82(x.nombre),
    ciudad_id: text82(x.ciudad_id),
    anunciante_id: text82(x.anunciante_id),
    suscriptor_id: text82(x.suscriptor_id),
    estado: "PENDIENTE",
    fecha: text82(x.creado_en),
    detalle: x.detalle || {}
  }));
  return {
    success: true,
    cantidades: {
      eventos: eventos.length,
      actividades: actividades.length,
      anunciantes: anunciantes.length,
      total: eventos.length + actividades.length + anunciantes.length
    },
    eventos,
    actividades,
    anunciantes
  };
}
function newAdvertiserId2() {
  return "ADV-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}
async function resolvePendingV3({ db, cache, auth, tipo, id: id4, decision, nivel = "" }) {
  const kind = text82(tipo).toUpperCase();
  const itemId = text82(id4);
  const dec = text82(decision).toUpperCase();
  if (!itemId || !["APROBAR", "RECHAZAR"].includes(dec)) throw new Error("Falta indicar contenido o decisión.");
  if (kind === "EVENTO") {
    return resolveEventModerationV2({
      db,
      cache,
      eventId: itemId,
      decision: dec,
      moderatorId: auth.sid
    });
  }
  if (kind === "ACTIVIDAD") {
    const current = await db.get("actividades", itemId);
    if (!current) throw new Error("Actividad no encontrada.");
    const horarios = await getPreparedRelationsV1({
      cache,
      type: "activity",
      id: itemId,
      current,
      load: () => db.queryEqual("actividad_horarios", "actividad_id", itemId, 500)
    });
    const previousCities = [...new Set(horarios.map((h) => text82(h.ciudad_id)).filter(Boolean))];
    const saved = await db.patch("actividades", itemId, {
      aprobado: dec === "APROBAR",
      estado: dec === "APROBAR" ? "ACTIVA" : "RECHAZADA",
      moderado_por: text82(auth.sid),
      moderado_en: (/* @__PURE__ */ new Date()).toISOString(),
      actualizado: (/* @__PURE__ */ new Date()).toISOString()
    }, { mustExist: true });
    await syncActivityPreparedV2({
      cache,
      activityId: itemId,
      current,
      next: saved,
      horarios,
      previousCities
    });
    return {
      success: true,
      tipo: kind,
      id: itemId,
      decision: dec,
      estado: saved.estado,
      actividad: { ...saved, horarios }
    };
  }
  if (kind === "ANUNCIANTE") {
    const req = await db.get("solicitudes_anunciante", itemId);
    if (!req) throw new Error("Solicitud de anunciante no encontrada.");
    if (text82(req.estado).toUpperCase() !== "PENDIENTE") throw new Error("La solicitud ya fue resuelta.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sid = text82(req.suscriptor_id), modo = text82(req.modo).toUpperCase();
    if (dec === "RECHAZAR") {
      const savedReq2 = await db.patch("solicitudes_anunciante", itemId, {
        estado: "RECHAZADA",
        moderado_por: text82(auth.sid),
        moderado_en: now,
        actualizado_en: now
      }, { mustExist: true });
      return { success: true, tipo: kind, id: itemId, decision: dec, solicitud: savedReq2 };
    }
    let aid = text82(req.anunciante_id);
    if (modo === "CREAR") {
      const level = text82(nivel);
      if (!level) throw new Error("Seleccioná el nivel del nuevo anunciante.");
      aid = newAdvertiserId2();
      const detail = req.detalle || {};
      const city = text82(req.ciudad_id);
      await db.patch("anunciantes", aid, {
        id: aid,
        nombre: text82(req.nombre),
        actividad: text82(detail.actividad),
        descripcion: text82(detail.descripcion),
        whatsapp: text82(detail.whatsapp),
        mail: text82(detail.mail),
        web: text82(detail.web),
        creado_en: now,
        actualizado_en: now
      });
      await db.patch("anunciantes_administracion", aid, {
        id: aid,
        aprobado: true,
        nivel: level,
        subnivel: "0",
        verificado: false,
        gold: false,
        funcionalidades: [],
        creado_en: now,
        actualizado_en: now
      });
      if (city) {
        const sedeId = "SED-" + aid + "-MAIN";
        await db.patch("anunciantes_sedes", sedeId, {
          sede_id: sedeId,
          anunciante_id: aid,
          ciudad_id: city,
          nombre_sede: "Principal",
          direccion: text82(detail.direccion),
          whatsapp: text82(detail.whatsapp),
          mail: text82(detail.mail),
          web: text82(detail.web),
          activo: true,
          creado_en: now,
          actualizado_en: now
        });
      }
    } else if (modo === "RECLAMAR") {
      if (!aid || !await db.get("anunciantes", aid)) throw new Error("El anunciante reclamado ya no existe.");
    } else {
      throw new Error("Tipo de solicitud inválido.");
    }
    const relId = sid + "__" + aid;
    await db.patch("suscriptor_anunciante", relId, {
      relacion_id: relId,
      suscriptor_id: sid,
      anunciante_id: aid,
      rol: "PROPIETARIO",
      activo: true,
      fecha_alta: now,
      actualizado: now
    });
    const savedReq = await db.patch("solicitudes_anunciante", itemId, {
      estado: "APROBADA",
      anunciante_id: aid,
      moderado_por: text82(auth.sid),
      moderado_en: now,
      actualizado_en: now
    }, { mustExist: true });
    if (modo === "CREAR") {
      await Promise.all([
        syncGuideAdvertiserV2({ db, cache, advertiserId: aid }),
        syncAdvertiserIndexV2({ db, cache, advertiserId: aid })
      ]);
    }
    return {
      success: true,
      tipo: kind,
      id: itemId,
      decision: dec,
      anunciante_id: aid,
      suscriptor_id: sid,
      solicitud: savedReq
    };
  }
  throw new Error("Tipo de contenido no reconocido.");
}

// reconstruccion/worker/routes/admin-v11.js
var text83 = (v) => String(v ?? "").trim();
function canModerate2(auth) {
  return ["SUPERADMIN_PRINCIPAL", "SUPERADMIN", "ADMIN_LOCAL"].includes(text83(auth && auth.rol).toUpperCase());
}
async function routeAdminV11(ctx) {
  const { path, request: request2, env, db, cache } = ctx;
  if (path === "/superadmin/moderation/pending" && request2.method === "GET") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate2(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    return json(await pendingAllV3({ db }));
  }
  if (path === "/superadmin/moderation/resolve" && request2.method === "POST") {
    const auth = await verifyAdmin(env, request2);
    if (!auth.ok) return json({ success: false, message: auth.message }, 401);
    if (!canModerate2(auth)) return json({ success: false, message: "Permiso insuficiente." }, 403);
    let body = {};
    try {
      body = await request2.json();
    } catch (_) {
    }
    return json(await resolvePendingV3({
      db,
      cache,
      auth,
      tipo: text83(body.tipo),
      id: text83(body.id || body.evento_id || body.actividad_id || body.solicitud_id),
      decision: text83(body.decision),
      nivel: text83(body.nivel)
    }));
  }
  return routeAdminV10(ctx);
}

// reconstruccion/worker/core/db-observation-v41.js
function observeDbV41(db, report) {
  const observed = {};
  for (const operation of Object.keys(db)) {
    observed[operation] = async (...args) => {
      const collection = String(args[0] || "");
      const key3 = operation + ":" + collection;
      const stat = report.operations[key3] || (report.operations[key3] = { operation, collection, calls: 0, documents_returned: 0, failures: 0 });
      stat.calls++;
      try {
        const result = await db[operation](...args);
        if (operation === "get" || operation === "queryEqual" || operation === "listCollection") {
          stat.documents_returned += Array.isArray(result) ? result.length : result ? 1 : 0;
        }
        return result;
      } catch (error) {
        stat.failures++;
        throw error;
      }
    };
  }
  return observed;
}
function observationPathV41(path) {
  return String(path).replace(/(\/advertisers\/)[^/]+/g, "$1:id").replace(/(\/subscribers\/)[^/]+/g, "$1:id");
}
async function observationActionV43(request2, url) {
  let action = url.searchParams.get("action") || "";
  if (url.pathname === "/suscriptores" && request2.method === "POST") {
    try {
      const body = await request2.clone().json();
      action = body.action || body.accion || action;
    } catch (_) {
    }
  }
  const allowed = /* @__PURE__ */ new Set([
    "ubicaciones",
    "locations",
    "bootstrap",
    "publicas",
    "turnos",
    "efemerides",
    "login",
    "session",
    "favoritos",
    "anunciantes_autorizados",
    "perfil",
    "suscriptor",
    "crear",
    "actualizar_perfil",
    "actualizar_ciudad",
    "cambiar_clave",
    "eliminar_cuenta",
    "agregar_favorito",
    "quitar_favorito",
    "solicitar_recuperacion",
    "restablecer_clave",
    "solicitar_verificacion",
    "confirmar_verificacion"
  ]);
  const value = String(action).trim().toLowerCase();
  return allowed.has(value) ? value : "";
}
function finishObservationV42(report) {
  const totals = { read_calls: 0, documents_returned: 0, write_calls: 0, delete_calls: 0, failures: 0 };
  for (const stat of Object.values(report.operations)) {
    if (["get", "queryEqual", "listCollection"].includes(stat.operation)) totals.read_calls += stat.calls;
    if (stat.operation === "patch") totals.write_calls += stat.calls;
    if (stat.operation === "delete") totals.delete_calls += stat.calls;
    totals.documents_returned += stat.documents_returned;
    totals.failures += stat.failures;
  }
  report.totals = totals;
  report.message = `GLD ${report.method} ${report.path}${report.action ? " action=" + report.action : ""} | HTTP ${report.status} | consultas ${totals.read_calls}, documentos ${totals.documents_returned}, escrituras ${totals.write_calls}, eliminaciones ${totals.delete_calls}, fallos ${totals.failures}`;
  return report;
}

function publicDbGuardV44(report){
  return Object.fromEntries(['get','queryEqual','listCollection','patch','delete'].map(operation=>[
    operation, async()=>{
      report.public_blocked=(report.public_blocked||0)+1;
      throw new Error('Acceso a Firestore bloqueado en una ruta pública: '+operation);
    }
  ]));
}


// reconstruccion/worker/core/private-cache-v46.js
var withPrivateCacheV46 = (() => {
/** Caché privada del login y favoritos, mantenida por mutaciones. No guarda contraseñas ni sustituye la autenticación. */
const text=v=>String(v??'').trim();
const relationKey=sid=>'login:relations:v45:'+text(sid);
const recordKey=(collection,id)=>'login:record:v45:'+collection+':'+text(id);
const panelAdminKey=id=>'panel:administration:v47:'+text(id);
const favoriteKey=sid=>'subscriber:favorites:v46:'+text(sid);
const advertiserCollections=new Set(['anunciantes','anunciantes_administracion']);

function withPrivateCacheV46(db,env){
  const kv=env.GLD_CACHE_KV;
  const owners=new Map();
  const dirty=new Set();
  const favoriteChanges=new Map();
  const deletedSubscribers=new Set();
  const favoriteDelta=(sid,id)=>favoriteKey(sid)+':delta:'+text(id);
  async function putRequired(key,value){
    try{await kv.put(key,value)}catch(first){await new Promise(resolve=>setTimeout(resolve,1100));await kv.put(key,value)}
  }
  function remember(collection,rows){
    if(['suscriptor_anunciante','suscriptor_favoritos'].includes(collection))for(const row of rows||[]){
      const id=text(row.id||row.suscriptor_anunciante_id||row.favorito_id),sid=text(row.suscriptor_id);
      if(id&&sid)owners.set(collection+'/'+id,sid);
    }
    return rows;
  }
  async function revision(key){
    if(!kv||typeof kv.get!=='function')return 'initial';
    return text(await kv.get(key+':revision',{cacheTtl:30}))||'initial';
  }
  async function read(key){
    const rev=await revision(key);
    if(!kv||typeof kv.get!=='function')return {packet:null,rev};
    const raw=await kv.get(key+':'+rev,{cacheTtl:30});
    if(!raw)return {packet:null,rev};
    try{const packet=JSON.parse(raw);
      if(packet&&packet.version===46)return {packet,rev};
      if(packet&&packet.version===45&&Number(packet.expires_at)>Date.now()){await save(key,packet.data,rev);return {packet,rev};}
      return {packet:null,rev};
    }catch(_){return {packet:null,rev}}
  }
  async function save(key,data,rev,meta={}){
    // Llenado opcional. Una falla deja la caché fría, sin romper el login.
    if(!kv||typeof kv.put!=='function'||dirty.has(key))return;
    try{await kv.put(key+':'+rev,JSON.stringify({version:46,data,...meta}))}catch(_){}
  }
  async function invalidate(key){
    const rev=await revision(key);
    if(kv&&typeof kv.delete==='function')await kv.delete(key+':'+rev);
    else if(kv&&(await read(key)).packet)throw Error('KV debe permitir invalidar la caché privada.');
    dirty.add(key);
  }
  async function flush(){
    // Cada favorito tiene su propia entrada: dos cambios de favoritos distintos
    // nunca sustituyen la lista del otro. Las bajas se conservan como tombstones.
    const updatedSubscribers=new Set();
    for(const [key,change] of favoriteChanges){
      try{if(kv&&kv.put)await putRequired(key,JSON.stringify(change));}
      catch(error){if(kv&&kv.delete)await kv.delete(key);await invalidate(favoriteKey(change.sid));throw error;}
      updatedSubscribers.add(change.sid);
      favoriteChanges.delete(key);
    }
    for(const sid of updatedSubscribers)if(kv&&kv.put){try{await putRequired(favoriteKey(sid)+':changes',JSON.stringify({revision:crypto.randomUUID(),updated_at:Date.now()}));}catch(error){await invalidate(favoriteKey(sid));throw error;}}
    for(const key of dirty){
      if(kv&&kv.put)await putRequired(key+':revision',crypto.randomUUID());
      dirty.delete(key);
    }
    for(const sid of deletedSubscribers){
      if(kv&&kv.list&&kv.delete){const keys=[];let cursor;do{const page=await kv.list({prefix:favoriteKey(sid)+':',...(cursor?{cursor}:{})});keys.push(...page.keys.map(k=>k.name));cursor=page.list_complete?null:page.cursor;}while(cursor);await Promise.all(keys.map(key=>kv.delete(key)));}
      deletedSubscribers.delete(sid);
    }
  }
  async function relationOwners(id,patch,options){
    // Si el router no cargó el vínculo, leer sólo ese documento para conocer
    // también su propietario anterior. Nunca barrer la colección.
    if(!owners.has('suscriptor_anunciante/'+text(id))){const previous=await db.get('suscriptor_anunciante',id);if(previous)remember('suscriptor_anunciante',[previous]);}
    const set=new Set([owners.get('suscriptor_anunciante/'+text(id)),text(patch&&patch.suscriptor_id),text(options&&options.subscriberId)].filter(Boolean));
    if(!set.size)throw Error('Falta contexto de suscriptor para invalidar su relación.');
    return set;
  }
  async function prepareFavorite(sid,id){
    const key=favoriteDelta(sid,id);
    return key;
  }
  async function overlayFavorites(sid,rows,packet,rev){
    if(!kv||typeof kv.list!=='function')return rows;
    const rawMarker=await kv.get(favoriteKey(sid)+':changes',{cacheTtl:30});
    if(!rawMarker)return rows;
    const marker=JSON.parse(rawMarker);
    if(packet&&packet.delta_revision===marker.revision)return rows;
    const byId=new Map(rows.map(r=>[text(r.id||r.favorito_id),r]));
    let cursor;
    do{
      const page=await kv.list({prefix:favoriteKey(sid)+':delta:',...(cursor?{cursor}:{})});
      const changes=await Promise.all(page.keys.map(async entry=>{const raw=await kv.get(entry.name,{cacheTtl:30});return raw?JSON.parse(raw):null}));
      for(const change of changes){if(!change||change.sid!==sid)continue;if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}
      cursor=page.list_complete?null:page.cursor;
    }while(cursor);
    for(const change of favoriteChanges.values())if(change.sid===sid){if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}
    const merged=[...byId.values()];
    // Durante propagación de KV repetir sólo el merge de KV. Nunca Firestore.
    await save(favoriteKey(sid),merged,rev,{delta_revision:Date.now()-Number(marker.updated_at)>60000?marker.revision:''});
    return merged;
  }
  return {
    ...db,
    flushLoginCache:flush,
    async get(collection,id){const row=await db.get(collection,id);if(row)remember(collection,[row]);return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async patch(collection,id,patch,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      if(collection==='anunciantes_administracion')await invalidate(panelAdminKey(id));
      let affected=[];
      if(collection==='suscriptor_anunciante'){
        affected=[...await relationOwners(id,patch,options)];
        for(const sid of affected)await invalidate(relationKey(sid));
      }
      let favKey;
      if(collection==='suscriptor_favoritos'){const sid=text(patch.suscriptor_id)||owners.get(collection+'/'+text(id));if(!sid)throw Error('Falta suscriptor del favorito.');favKey=await prepareFavorite(sid,id);}
      const row=await db.patch(collection,id,patch,options);
      if(favKey)favoriteChanges.set(favKey,{sid:text(patch.suscriptor_id)||owners.get(collection+'/'+text(id)),id:text(id),deleted:false,data:{...patch,...row,id:text(id)}});
      if(row)remember(collection,[row]);
      return row;
    },
    async delete(collection,id,options={}){
      if(advertiserCollections.has(collection))await invalidate(recordKey(collection,id));
      if(collection==='anunciantes_administracion')await invalidate(panelAdminKey(id));
      if(collection==='suscriptor_anunciante')for(const sid of await relationOwners(id,null,options))await invalidate(relationKey(sid));
      let favKey;
      if(collection==='suscriptor_favoritos'){let sid=owners.get(collection+'/'+text(id))||text(options.subscriberId);if(!sid){const previous=await db.get(collection,id);if(previous){remember(collection,[previous]);sid=text(previous.suscriptor_id);}}if(sid)favKey=await prepareFavorite(sid,id);}
      if(collection==='suscriptores'){deletedSubscribers.add(text(id));await invalidate(relationKey(id));await invalidate(favoriteKey(id));for(const [key,change]of favoriteChanges)if(change.sid===text(id))favoriteChanges.delete(key);}
      const result=await db.delete(collection,id,options);
      if(favKey)favoriteChanges.set(favKey,{sid:owners.get(collection+'/'+text(id))||text(options.subscriberId),id:text(id),deleted:true});
      return result;
    },
    async subscriberFavorites(sid){
      const key=favoriteKey(sid);
      const {packet,rev}=await read(key);
      if(packet&&Array.isArray(packet.data)&&!dirty.has(key))return remember('suscriptor_favoritos',await overlayFavorites(sid,packet.data,packet,rev));
      const rows=remember('suscriptor_favoritos',await db.queryEqual('suscriptor_favoritos','suscriptor_id',sid,500));
      await save(key,rows,rev);return remember('suscriptor_favoritos',await overlayFavorites(sid,rows,null,rev));
    },
    async loginRelations(sid){
      const key=relationKey(sid),{packet:hit,rev}=await read(key);
      if(hit&&Array.isArray(hit.data)&&!dirty.has(key))return remember('suscriptor_anunciante',hit.data);
      const rows=remember('suscriptor_anunciante',await db.queryEqual('suscriptor_anunciante','suscriptor_id',sid,100));
      // Almacenar solamente los campos que usa el login.
      await save(key,rows.map(r=>({id:text(r.id||r.suscriptor_anunciante_id),suscriptor_id:text(r.suscriptor_id),anunciante_id:text(r.anunciante_id),anunciante_nombre:text(r.anunciante_nombre),rol:text(r.rol),permisos:text(r.permisos),activo:r.activo})),rev);
      return rows;
    },
    async panelAdministration(id){
      const key=panelAdminKey(id),{packet:hit,rev}=await read(key);
      if(hit&&!dirty.has(key))return hit.data;
      const row=await db.get('anunciantes_administracion',id);
      await save(key,row,rev);return row;
    },
    async loginAdvertiser(collection,id){
      if(!advertiserCollections.has(collection))throw Error('Colección no admitida para caché del login.');
      const key=recordKey(collection,id),{packet:hit,rev}=await read(key);
      if(hit&&!dirty.has(key))return hit.data;
      const row=await db.get(collection,id);
      const data=row?{id:text(row.id||id),nombre:text(row.nombre),funcionalidades:row.funcionalidades}:null;
      await save(key,data,rev);
      return data;
    }
  };
}
return withPrivateCacheV46;
})();

// reconstruccion/worker/core/panel-cache-v48.js
var withPanelCacheV48 = (() => {
/** Lecturas privadas del panel. Listas por propietario y cambios por documento. */
const fields={efemerides_bis:['tipo','provincia_id','ciudad_id'],eventos:['anunciante_id','estado_moderacion','ciudad_id'],evento_programacion:'evento_id',actividades:['anunciante_id','aprobado'],solicitudes_anunciante:'estado',actividad_horarios:'actividad_id',promos:'anunciante_id',anunciantes_sedes:'anunciante_id',farmacias_ciclos:'anunciante_id',farmacias_ciclo_sedes:'ciclo_id',publicidades:'anunciante_id',publicidad_media:'publicidad_id',publicidad_segmentacion:'publicidad_id'};
const text=v=>String(v??'').trim();
const queryKey=(c,v,field)=>'panel:query:v48:'+c+':'+(c==='efemerides_bis'||field==='estado_moderacion'||field==='ciudad_id'||field==='aprobado'?field+':':'')+encodeURIComponent(text(v));
const matchesField=(c,field)=>Array.isArray(fields[c])?fields[c].includes(field):fields[c]===field;
const advertiserKey=id=>'panel:record:v53:anunciantes:'+encodeURIComponent(text(id));
const docKey=id=>'panel:record:v48:publicidad_cambios:'+encodeURIComponent(text(id));
function withPanelCacheV48(db,env){
  const kv=env.GLD_CACHE_KV,known=new Map(),changes=new Map(),records=new Map(),pending=new Map();
  const copy=x=>x==null?x:structuredClone(x);
  function remember(c,rows){for(const row of rows||[])if(row&&row.id)known.set(c+'/'+text(row.id),copy(row));return rows;}
  async function read(key){if(!kv?.get)return null;const raw=await kv.get(key,{cacheTtl:30});if(!raw)return null;try{const p=JSON.parse(raw);return p?.version===48?p:null;}catch(_){return null;}}
  async function optionalSave(key,value){if(kv?.put)try{await kv.put(key,JSON.stringify({version:48,...value}));}catch(_){}}
  async function requiredSave(key,value){if(!kv?.put)return;try{await kv.put(key,JSON.stringify(value));}catch(_){await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify(value));}}
  async function merge(key,packet){
    const marker=await read(key+':changes');
    const own=[...changes.values()].filter(c=>c.key===key);
    if(!marker&&!own.length)return packet.data;
    if(marker&&packet.revision===marker.revision&&!own.length)return packet.data;
    const byId=new Map(packet.data.map(row=>[text(row.id),row]));
    if(marker&&kv?.list){let cursor;do{const page=await kv.list({prefix:key+':delta:',...(cursor?{cursor}:{})});for(const item of page.keys){const change=await read(item.name);if(change){if(change.deleted)byId.delete(change.id);else byId.set(change.id,change.data);}}cursor=page.list_complete?null:page.cursor;}while(cursor);}
    for(const c of own){if(c.deleted)byId.delete(c.id);else byId.set(c.id,c.data);}
    const data=[...byId.values()];
    if(marker&&!own.length)await optionalSave(key,{data,revision:Date.now()-marker.updated_at>60000?marker.revision:''});
    return data;
  }
  async function panelQuery(c,field,value,limit=500){
    if(!matchesField(c,field)||Number(limit)!==500)return db.queryEqual(c,field,value,limit);
    const key=queryKey(c,value,field);
    if(pending.has(key))return copy(await pending.get(key));
    const operation=(async()=>{let packet=await read(key);if(!Array.isArray(packet?.data)){const data=remember(c,await db.queryEqual(c,field,value,500));packet={version:48,data,revision:''};await optionalSave(key,packet);}return remember(c,await merge(key,packet));})();
    pending.set(key,operation);try{return copy(await operation);}finally{pending.delete(key);}
  }
  async function panelGet(c,id){
    if(c==='anunciantes_administracion'&&db.panelAdministration)return db.panelAdministration(id);
    if(!['publicidad_cambios','anunciantes'].includes(c))return db.get(c,id);
    if(c==='publicidad_cambios'){
      const match=text(id).match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
      if(match){
        const key='panel:counter:v58:'+encodeURIComponent(match[1]),date=match[2],hit=await read(key);
        if(hit&&hit.date===date)return copy(hit.data);
        if(hit&&hit.date<date){await optionalSave(key,{date,data:null});return null;}
        const legacy=await read(docKey(id));
        const data=legacy?legacy.data:await db.get(c,id);
        // Never regress the rolling date for requests that crossed midnight.
        if(!hit||hit.date<=date)await optionalSave(key,{date,data});
        return data;
      }
    }
    const key=c==='anunciantes'?advertiserKey(id):docKey(id);if(records.has(key))return copy(records.get(key));
    const hit=await read(key);if(hit)return copy(hit.data);
    const data=await db.get(c,id);await optionalSave(key,{data});return data;
  }
  async function beforeMutation(c,id,patch,options){
    if(!fields[c])return null;
    const k=c+'/'+text(id);
    // Creaciones declaradas por el módulo no requieren leer un ID recién generado.
    if(!known.has(k)&&!options.newDocument){const old=await db.get(c,id);known.set(k,copy(old));}
    return copy(known.get(k)||null);
  }
  function queue(c,id,old,row){
    const entry=fields[c];if(!entry)return;
    for(const field of (Array.isArray(entry)?entry:[entry])){
      const prior=text(old?.[field]),next=text(row?.[field]);
      if(prior&&prior!==next){const key=queryKey(c,prior,field);changes.set(key+':delta:'+text(id),{key,id:text(id),deleted:true});}
      if(next){const key=queryKey(c,next,field);changes.set(key+':delta:'+text(id),{key,id:text(id),deleted:false,data:{...row,id:text(id)}});}
    }
    known.set(c+'/'+text(id),copy(row));
  }
  async function flush(){
    const affected=new Set();
    for(const [key,change]of changes){affected.add(change.key);try{await requiredSave(key,{version:48,...change});}catch(error){if(kv?.delete)await kv.delete(change.key);throw error;}}
    for(const key of affected){try{await requiredSave(key+':changes',{version:48,revision:crypto.randomUUID(),updated_at:Date.now()});}catch(error){if(kv?.delete)await kv.delete(key);throw error;}}
    changes.clear();
    for(const [key,data]of records){try{await requiredSave(key,{version:48,data});}catch(error){if(kv?.delete)await kv.delete(key);throw error;}}
    for(const [key,data]of records){
      const prefix='panel:record:v48:publicidad_cambios:';
      if(key.startsWith(prefix)){
        const match=decodeURIComponent(key.slice(prefix.length)).match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
        if(match){const rolling='panel:counter:v58:'+encodeURIComponent(match[1]);const hit=await read(rolling);if(!hit||hit.date<=match[2])await requiredSave(rolling,{version:48,date:match[2],data});}
      }
    }

    records.clear();
    if(db.flushLoginCache)await db.flushLoginCache();
  }
  return {...db,
    async cachedPanelRows(c,field,value){const key=queryKey(c,value,field);const packet=await read(key);return Array.isArray(packet?.data)?copy(await merge(key,packet)):null;},
    rememberPanelRows(c,rows){if(fields[c])remember(c,rows);},
    async prepareNewPanelList(c,field,value){if(matchesField(c,field))await optionalSave(queryKey(c,value,field),{data:[],revision:''});},
    panelReadDb(){return {...db,get:panelGet,queryEqual:panelQuery};},
    flushLoginCache:flush,
    async get(c,id){const row=await db.get(c,id);if(fields[c])known.set(c+'/'+text(id),copy(row));return row;},
    async queryEqual(...args){return remember(args[0],await db.queryEqual(...args));},
    async patch(c,id,patch,options={}){
      const old=await beforeMutation(c,id,patch,options);
      if(['publicidad_cambios','anunciantes'].includes(c)&&kv?.delete)await kv.delete(c==='anunciantes'?advertiserKey(id):docKey(id));
      const row=await db.patch(c,id,patch,options);queue(c,id,old,{...old,...patch,...row,id:text(id)});
      if(['publicidad_cambios','anunciantes'].includes(c))records.set(c==='anunciantes'?advertiserKey(id):docKey(id),row||{...patch,id:text(id)});
      return row;
    },
    async delete(c,id,options={}){
      const old=await beforeMutation(c,id,null,options);
      if(['publicidad_cambios','anunciantes'].includes(c)&&kv?.delete)await kv.delete(c==='anunciantes'?advertiserKey(id):docKey(id));
      const result=await db.delete(c,id,options);queue(c,id,old,null);
      if(['publicidad_cambios','anunciantes'].includes(c))records.set(c==='anunciantes'?advertiserKey(id):docKey(id),null);
      return result;
    }
  };
}

return withPanelCacheV48;
})();

// Private authentication projection. Passwords never stored in KV or public responses.
function withAuthCacheV58(db,env){
 const kv=env.GLD_CACHE_KV,rawRows=new Map(),enc=new TextEncoder();
 const text=v=>String(v??'').trim(),norm=v=>text(v).toLowerCase();
 const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
 const unhex=s=>Uint8Array.from(s.match(/../g)||[],v=>parseInt(v,16));
 async function mailKey(mail){const secret=text(env.SERVER_SECRET);if(!secret)throw Error('Falta SERVER_SECRET');const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'auth:mail:v58:'+hex(await crypto.subtle.sign('HMAC',key,enc.encode(norm(mail))));}
 const sidKey=id=>'auth:sid:v58:'+text(id);
 async function load(key){if(!kv?.get)return null;const v=await kv.get(key,{cacheTtl:30});if(!v)return null;try{const p=JSON.parse(v);return p.version===58?p:null;}catch{return null;}}
 async function put(key,p){if(!kv?.put)throw Error('Falta caché privada de autenticación');try{await kv.put(key,JSON.stringify({...p,version:58}));}catch{await new Promise(r=>setTimeout(r,1100));await kv.put(key,JSON.stringify({...p,version:58}));}}
 async function verifier(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(text(password)),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256));}
 async function packet(row,prior){const {clave,...data}=row;let salt=prior?.salt,digest=prior?.digest;if(clave!==undefined){salt=hex(crypto.getRandomValues(new Uint8Array(16)));digest=await verifier(clave,salt);}if(!salt||!digest)throw Error('Falta verificador de cuenta');return {version:58,data,salt,digest};}
 async function store(row,prior){const p=await packet(row,prior),key=await mailKey(row.mail);await put(key,p);await put(sidKey(row.suscriptor_id||row.id),{mail_key:key});return p;}
 async function previous(id){if(rawRows.has(text(id)))return {row:rawRows.get(text(id)),p:null};const index=await load(sidKey(id));const p=index?await load(index.mail_key):null;if(p?.data)return {row:p.data,p};const row=await db.get('suscriptores',id);return {row,p:null};}
 return {...db,
  async loginAccount(mail,password,originalMail=mail){const key=await mailKey(mail),hit=await load(key);if(hit){if(hit.deleted||!hit.data)return null;const digest=await verifier(password,hit.salt);let diff=digest.length^hit.digest.length;for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^hit.digest.charCodeAt(i);return diff?null:structuredClone(hit.data);}
   let rows=await db.queryEqual('suscriptores','mail',norm(mail),5);if(!rows.length&&originalMail!==norm(mail))rows=await db.queryEqual('suscriptores','mail',originalMail,5);const row=rows.find(r=>norm(r.mail)===norm(mail));if(!row){await put(key,{deleted:true});return null;}rawRows.set(text(row.suscriptor_id||row.id),row);await store(row);if(text(row.clave)!==text(password))return null;const {clave,...data}=row;return data;
  },
  async get(c,id){const row=await db.get(c,id);if(c==='suscriptores'&&row)rawRows.set(text(id),row);return row;},
  async patch(c,id,patch,options={}){if(c!=='suscriptores')return db.patch(c,id,patch,options);const old=await previous(id);const result=await db.patch(c,id,patch,options);const row={...old.row,...patch,...result,id:text(id)};if(old.row?.mail&&norm(old.row.mail)!==norm(row.mail))await put(await mailKey(old.row.mail),{deleted:true});await store(row,old.p);rawRows.set(text(id),row);return result;},
  async delete(c,id,options={}){if(c!=='suscriptores')return db.delete(c,id,options);const old=await previous(id),result=await db.delete(c,id,options);if(old.row?.mail)await put(await mailKey(old.row.mail),{deleted:true});await put(sidKey(id),{deleted:true});rawRows.delete(text(id));return result;}
 };
}

// reconstruccion/worker/app-main-v35.js

const clean=p=>{
  p=String(p||"/").replace(/\/+/g,"/");
  return p.length>1&&p.endsWith("/")?p.slice(0,-1):p;
};

var app_main_v35_default = {
  async fetch(request,env){
    const report={event:'gld_firestore_observation',worker_version:'62',started_at:new Date().toISOString(),status:500,request_id:crypto.randomUUID(),method:request.method,path:observationPathV41(clean(new URL(request.url).pathname)),operations:{}};
    let db,cacheFlushed=false;
    const traced=async response=>{
      if(db&&db.flushLoginCache&&!cacheFlushed){cacheFlushed=true;await db.flushLoginCache();}
      report.status=response.status;
      const headers=new Headers(response.headers);
      headers.set('X-GLD-Request-Id',report.request_id);
      const {totals}=finishObservationV42(report);
      headers.set('X-GLD-Worker-Version',report.worker_version);
      headers.set('X-GLD-Read-Calls',String(totals.read_calls));
      headers.set('X-GLD-Documents-Returned',String(totals.documents_returned));
      headers.set('X-GLD-Write-Calls',String(totals.write_calls));
      headers.set('X-GLD-Delete-Calls',String(totals.delete_calls));
      headers.set('X-GLD-Source',report.source||'worker');
      headers.set('X-GLD-Public-Blocked',String(report.public_blocked||0));
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    };
    try{
      if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
      const url=new URL(request.url),path=clean(url.pathname);
      db=withPanelCacheV48(withAuthCacheV58(withPrivateCacheV46(observeDbV41(createDb(env),report),env),env),env);
      const cache=createCache(env);
      const action=await observationActionV43(request,url);
      if(action)report.action=action;
      const ctx={path,request,url,env,db,cache};

      if(path==="/")return await traced(json({success:true,app:"Guía Local reconstrucción modular",version:"62"}));

      const pub=await routePublicV12({...ctx,db:publicDbGuardV44(report)});if(pub){report.source='public-kv';return await traced(pub);}
      const panel=await routePanelV15(ctx);if(panel)return await traced(panel);
      const admin=await routeAdminV11(ctx);if(admin)return await traced(admin);

      return await traced(json({success:false,message:"Ruta no encontrada"},404));
    }catch(err){
      return await traced(json({success:false,message:String(err&&err.message?err.message:err)},500));
    }finally{
      if(request.method!=="OPTIONS")console.log(JSON.stringify(finishObservationV42(report)));
    }
  }
};
export {app_main_v35_default as default};
