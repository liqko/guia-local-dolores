/**
 * events_unified.gs
 *
 * Archivo UNIFICADO para Events (usa hojas: eventos_vip, eventos_free, unificada, aux_lugares, aux_localidad)
 * - Destino principal: hoja "unificada"
 * - Orígenes: "eventos_vip" (prioridad) y "eventos_free"
 * - Funciones: createEvent / updateEvent / deleteEvent / pauseEvent / getEvents
 * - Autocompleta lugar desde "aux_lugares" / "lugares_list" (direccion, llegar)
 * - Autocompleta logos de partner desde "partner_list"
 * - Sincronizador: syncUnificadaFromSources() combina eventos_vip + eventos_free -> unificada
 * - Purga: elimina eventos con fecha anterior a hoy
 * - Enriquecido: rellena direccion/llegar, logos de partners, logo_categoria, organizador/logo_organizador (por id_anunciante) tanto en origen (VIP/FREE) como en unificada.
 *
 * FIX IMPORTANTE (2026-01-19):
 *  - Preserva la columna A (checkbox "aprobado") en unificada.
 *  - No borra el check al sincronizar (evita web en blanco).
 *
 * AGREGADO (Dashboard Eventos VIP):
 *  - Agrega soporte CRUD VIP por API (doPost):
 *      - getVipEvents
 *      - createVipEvent
 *      - updateVipEvent
 *      - deleteVipEvent
 *  - Agrega columna 'evento_id' a eventos_vip (sin romper el mapeo actual de unificada):
 *      - Se agrega AL FINAL de eventos_vip y se llena automáticamente al crear desde dashboard.
 *      - syncUnificadaFromSources usa evento_id si existe, sino genera vip-noid-* como antes.
 *
 * FIX NUEVO (2026-01-19+):
 *  - Hora/hora2 siempre como TEXTO "HH:MM" (evita 1899/1900).
 *  - Unificada: sync incremental (upsert). Nuevos eventos al final, los existentes no se mueven.
 *
 * FIX NUEVO (2026-01-19+2):
 *  - Evita “huecos” en unificada: append inteligente usando evento_id como referencia.
 *  - No pre-crea 200 filas vacías con checkboxes (evita bloque enorme vacío).
 *
 * FIX NUEVO (2026-01-20):
 *  - FREE ahora también tiene columna evento_id (estable).
 *  - syncUnificadaFromSources borra de unificada eventos que ya no existen en VIP/FREE.
 *
 * NUEVO (2026-01-21 - A+B+C):
 *  A) Pausado + API VIP:
 *     - Columna 'pausado' en EVENTS_HEADERS (unificada) y VIP_HEADERS (eventos_vip)
 *     - Endpoint pauseVipEvent para pausar/reanudar eventos VIP por evento_id
 *     - syncUnificadaFromSources copia campo 'pausado' desde VIP/FREE a unificada
 *  B) Sync aux → list:
 *     - syncAuxLugaresToList() - aux_lugares → lugares_list
 *     - syncAuxLocalidadToList() - aux_localidad → localidad_list
 *     - syncAuxPartnerToList() - aux_partner → partner_list
 *     - syncAuxCategoriasToList() - aux_categorias → categorias_list
 *     - syncAllAuxToList() - ejecuta todos los syncs
 *     - Idempotente, evita duplicados por nombre normalizado
 *  C) Trigger automático:
 *     - scheduledAuxListSync() - función ejecutada periódicamente
 *     - ensureAuxListSyncTrigger() - crea trigger cada 6 horas
 *     - Integrado en ensureAutoSyncTriggers()
 */

/* ---------- CONSTANTES (Nombres de hojas) ---------- */
const EVENTS_SHEET_NAME = 'unificada';
const VIP_SHEET_NAME = 'eventos_vip';
const FREE_SHEET_NAME = 'eventos_free';
const IMPORT_SHEET_NAME = 'anunciantes_import';
const CATEGORIES_SHEET_NAME = 'categorias_list';
const AUX_CATS_SHEET = 'aux_categorias';
const AUX_PLACES_SHEET = 'aux_lugares';
const AUX_LOCALIDAD_SHEET = 'aux_localidad';
const SPREADSHEET_ANNUNCIANTES_ID = '170kTZ-ViCPxPli86g-n_XMuMv1S3O0-DbGwNFGYVnjY';

/* ---------- Nuevas constantes (listas auxiliares) ---------- */
const LOCALIDAD_LIST_SHEET = 'localidad_list';
const LUGARES_LIST_SHEET = 'lugares_list';
const AUX_PARTNER_SHEET = 'aux_partner';
const PARTNER_LIST_SHEET = 'partner_list';
const ANUNCIANTES_AUT_SHEET = 'anunciantes_aut';

/* Server secret optional (leave or change) */
const SERVER_SECRET = 'PzbqSEw9xNrwvWruJN7njiW905uwMiBS';

/* Encabezados EXACTOS para la hoja 'unificada' */
const EVENTS_HEADERS = [
  'aprobado','nivel','evento_id','id_anunciante','organizador','logo_organizador','categoria','logo_categoria',
  'nombre_evento','localidad','lugar','direccion','llegar','fecha','hora','hora2','descripcion','instagram',
  'img1','img2','img3','entradas','partner','logo_partner','partner2','logo_partner2','partner3','logo_partner3',
  'partner4','logo_partner4','partner5','logo_partner5','partner6','logo_partner6','pausado','audit'
];

/**
 * Encabezados para la hoja 'eventos_vip'
 * IMPORTANTE:
 * - Se mantiene el orden original.
 * - Se agrega 'evento_id' y 'pausado' AL FINAL (para no romper el mapeo a unificada que usa offset 3).
 * - ORDEN CORRECTO: evento_id ANTES de pausado (corregido para evitar confusión en dashboard)
 */
const VIP_HEADERS = [
  'id_anunciante','organizador','logo_organizador','categoria','logo_categoria','nombre_evento','localidad',
  'lugar','direccion','llegar','fecha','hora','hora2','descripcion','instagram','img1','img2','img3','entradas',
  'partner','logo_partner','partner2','logo_partner2','partner3','logo_partner3','partner4','logo_partner4',
  'partner5','logo_partner5','partner6','logo_partner6','audit',
  'evento_id','pausado'
];

/* -------------------- AUTO-SYNC CONFIG -------------------- */
const AUTO_SYNC_THROTTLE_SECONDS = 30;     // evita loops / múltiples sync seguidos
const AUTO_SYNC_TIME_MINUTES = 5;          // cada cuánto corre el sync por tiempo (backup)
const KEEP_HOURLY_MAINTENANCE = true;      // deja el maintenance cada 1h además del sync cada 5m

/* ---------- UTILITARIOS ---------- */
function getHeaders(sheet) {
  if (!sheet) return [];
  return sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getValues()[0]
    .map(h => String(h||'').toLowerCase().trim());
}
function jsonResponse(obj, status) {
  status = status || 200;
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
function _norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
function normalizeKey(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\-\s]/g,''); }
function SECRET_RESTRICTION() { return !!SERVER_SECRET; }
function colLetterToIndex(letter){
  if(!letter) return -1;
  letter = String(letter).toUpperCase().replace(/[^A-Z]/g,'');
  let sum = 0;
  for(let i=0;i<letter.length;i++){
    sum = sum * 26 + (letter.charCodeAt(i) - 64);
  }
  return sum;
}

/* ---------- helpers IDs ---------- */
function _generateEventoId_(prefix){
  prefix = String(prefix || 'vip').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const now = Date.now();
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${now}-${rnd}`;
}

/* ---------- FIX: normalización de hora/hora2 ---------- */
function _isIsoZ_(s){ return typeof s === 'string' && /Z$/.test(s); }

/**
 * Convierte cualquier valor "hora" a texto "HH:MM".
 * Evita que Sheets muestre 1899/1900 y evita ISO raros.
 */
function normalizeTimeText_(v){
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '';

    // HH:MM o HH:MM:SS
    let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return String(m[1]).padStart(2,'0') + ':' + m[2];

    // ISO date-time tipo 1899-12-30T18:00:00.000Z
    if (s.indexOf('T') !== -1) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const useUtc = _isIsoZ_(s);
        const hh = String(useUtc ? d.getUTCHours() : d.getHours()).padStart(2,'0');
        const mm = String(useUtc ? d.getUTCMinutes() : d.getMinutes()).padStart(2,'0');
        return hh + ':' + mm;
      }
    }

    // fracción del día en string
    const n = Number(s.replace(',','.'));
    if (!isNaN(n) && isFinite(n) && n >= 0 && n < 1) {
      const totalMinutes = Math.round(n * 24 * 60);
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2,'0');
      const mm = String(totalMinutes % 60).padStart(2,'0');
      return hh + ':' + mm;
    }

    return s; // fallback
  }

  // Date object
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    const hh = String(v.getHours()).padStart(2,'0');
    const mm = String(v.getMinutes()).padStart(2,'0');
    return hh + ':' + mm;
  }

  // fracción del día (Sheets)
  if (typeof v === 'number' && !isNaN(v) && isFinite(v) && v >= 0 && v < 1) {
    const totalMinutes = Math.round(v * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2,'0');
    const mm = String(totalMinutes % 60).padStart(2,'0');
    return hh + ':' + mm;
  }

  return String(v).trim();
}

function normalizeDateText_(v){
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(v).trim();
}

/* ---------- FECHA/PURGA HELPERS ---------- */
function parseFechaAsDate(valor){
  if (valor === null || valor === undefined || valor === '') return null;
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) return valor;
  if (typeof valor === 'number' && !isNaN(valor)) {
    const ms = (valor - 25569) * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }
  const s = String(valor).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
  m = s.match(/^Date\((\d{4}),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+))?/);
  if (m) return new Date(parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10));
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}
function isDateBeforeToday(dateObj){
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  const tz = Session.getScriptTimeZone() || 'GMT';
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const today = new Date(todayStr + 'T00:00:00');
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  return d.getTime() < today.getTime();
}
function purgePastEventsFromUnificada(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { removed:0, checked:0, reason:'no sheet' };

  const headers = getHeaders(sh);
  const fechaIdx = headers.indexOf('fecha');
  const fechaIsoIdx = headers.indexOf('fecha_iso');
  if (fechaIdx === -1 && fechaIsoIdx === -1) return { removed:0, checked:0, reason:'no fecha column' };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { removed:0, checked:0 };
  const data = sh.getRange(2,1,rows,headers.length).getValues();

  let removed = 0;
  let checked = 0;
  for (let r = data.length - 1; r >= 0; r--) {
    const rawFecha = (fechaIdx !== -1 ? data[r][fechaIdx] : '') || (fechaIsoIdx !== -1 ? data[r][fechaIsoIdx] : '');
    if (rawFecha === '' || rawFecha === null) continue;
    const d = parseFechaAsDate(rawFecha);
    if (!d) continue;
    checked++;
    if (isDateBeforeToday(d)) {
      sh.deleteRow(r + 2);
      removed++;
    }
  }
  return { removed, checked };
}

/* ---------- helpers para preservar checkboxes ---------- */
function _normalizeBoolean_(v){
  const s = String(v||'').toLowerCase().trim();
  if (v === true) return true;
  if (v === false) return false;
  if (s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return false;
}
function _buildAprobadoMapFromUnificada_(shTarget, targetHeaders){
  const idxEvento = targetHeaders.indexOf('evento_id');
  const idxAprobado = targetHeaders.indexOf('aprobado');
  const map = {};
  if (idxEvento === -1 || idxAprobado === -1) return map;

  const rows = Math.max(0, shTarget.getLastRow() - 1);
  if (!rows) return map;

  const data = shTarget.getRange(2, 1, rows, targetHeaders.length).getValues();
  for (let i=0;i<data.length;i++){
    const id = String(data[i][idxEvento] || '').trim();
    if (!id) continue;
    map[id] = _normalizeBoolean_(data[i][idxAprobado]);
  }
  return map;
}
function _ensureAprobadoCheckboxesAndDefaults_(shTarget){
  try {
    const startRow = 2;
    const rows = Math.max(0, shTarget.getLastRow() - 1);
    if (rows <= 0) return;

    const range = shTarget.getRange(startRow, 1, rows, 1);
    range.insertCheckboxes();

    const vals = range.getValues();
    let needWrite = false;
    for (let i=0;i<vals.length;i++){
      const v = vals[i][0];
      if (v === '' || v === null) { vals[i][0] = false; needWrite = true; }
      else vals[i][0] = _normalizeBoolean_(v);
    }
    if (needWrite) range.setValues(vals);
  } catch(e){
    console.warn('_ensureAprobadoCheckboxesAndDefaults_ failed', e);
  }
}

/* ---------- append inteligente para evitar huecos ---------- */
function appendUnificadaRowSmart_(shTarget, targetHeaders, rowOut){
  const idxEvento = targetHeaders.indexOf('evento_id');
  if (idxEvento === -1) {
    shTarget.appendRow(rowOut);
    return shTarget.getLastRow();
  }

  const lastRow = shTarget.getLastRow();
  const start = 2;
  const n = Math.max(0, lastRow - 1);

  // Si no hay datos (solo header)
  if (n === 0){
    shTarget.getRange(2, 1, 1, rowOut.length).setValues([rowOut]);
    return 2;
  }

  // Leemos la columna evento_id y buscamos el último id no vacío
  const ids = shTarget.getRange(start, idxEvento + 1, n, 1).getValues();
  let lastWithId = 1; // header
  for (let i = ids.length - 1; i >= 0; i--){
    const v = String(ids[i][0] || '').trim();
    if (v){
      lastWithId = start + i;
      break;
    }
  }

  const writeRow = lastWithId + 1;
  shTarget.getRange(writeRow, 1, 1, rowOut.length).setValues([rowOut]);
  return writeRow;
}

/* ---------- NUEVO (2026-01-20): evento_id estable en FREE ---------- */
function ensureFreeEventoIdColumnAndFill_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FREE_SHEET_NAME);
  if (!sh) return { ok:false, reason:'no_free_sheet' };

  const headers = getHeaders(sh);
  let idxEvento = headers.indexOf('evento_id');

  // Crear columna evento_id al final si no existe
  if (idxEvento === -1) {
    const newCol = sh.getLastColumn() + 1;
    sh.getRange(1, newCol).setValue('evento_id');
    idxEvento = newCol - 1;
  }

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { ok:true, created:(headers.indexOf('evento_id')===-1), filled:0 };

  const idRange = sh.getRange(2, idxEvento + 1, rows, 1);
  const vals = idRange.getValues();

  let filled = 0;
  for (let i=0;i<vals.length;i++){
    const cur = String(vals[i][0] || '').trim();
    if (!cur){
      vals[i][0] = _generateEventoId_('free');
      filled++;
    }
  }
  if (filled > 0) idRange.setValues(vals);

  return { ok:true, created:(headers.indexOf('evento_id')===-1), filled };
}

/* ---------- ENRIQUECIMIENTO DESDE LISTAS (unificada) ---------- */
function enrichUnificadaRowsFromLists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { enriched:0, checked:0 };

  const headers = getHeaders(sh);
  if (headers.length === 0) return { enriched:0, checked:0 };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { enriched:0, checked:0 };

  const lugaresMap = {};
  const lugaresSh = ss.getSheetByName(LUGARES_LIST_SHEET);
  if (lugaresSh && lugaresSh.getLastRow() >= 2) {
    const vals = lugaresSh.getRange(2,1,lugaresSh.getLastRow()-1,3).getValues();
    for (const r of vals) {
      const name = _norm(r[0] || '');
      if (!name) continue;
      lugaresMap[name] = { direccion: r[1] || '', llegar: r[2] || '' };
    }
  }

  const partnerLogoMap = {};
  const partnerSh = ss.getSheetByName(PARTNER_LIST_SHEET);
  if (partnerSh && partnerSh.getLastRow() >= 2) {
    const vals = partnerSh.getRange(2,1,partnerSh.getLastRow()-1,2).getValues();
    for (const r of vals) {
      const name = _norm(r[0] || '');
      if (!name) continue;
      partnerLogoMap[name] = r[1] || '';
    }
  }

  const headersCat = ss.getSheetByName(CATEGORIES_SHEET_NAME);

  const idxLugar = headers.indexOf('lugar');
  const idxDir = headers.indexOf('direccion');
  const idxLlegar = headers.indexOf('llegar');
  const idxCategoria = headers.indexOf('categoria');
  const idxLogoCategoria = headers.indexOf('logo_categoria');
  const idxIdAnunciante = headers.indexOf('id_anunciante');
  const idxOrganizador = headers.indexOf('organizador');
  const idxLogoOrganizador = headers.indexOf('logo_organizador');

  const partnerIdx = [];
  const logoPartnerIdx = [];
  for (let i=1;i<=6;i++){
    partnerIdx.push(headers.indexOf(i===1 ? 'partner' : 'partner'+i));
    logoPartnerIdx.push(headers.indexOf(i===1 ? 'logo_partner' : 'logo_partner'+i));
  }

  const data = sh.getRange(2,1,rows,headers.length).getValues();
  let enriched = 0;
  const out = data.map(r => r.slice());

  for (let i=0;i<data.length;i++){
    const row = data[i];
    let changed = false;

    if (idxIdAnunciante !== -1) {
      const advId = String(row[idxIdAnunciante] || '').trim();
      if (advId) {
        const adv = getAdvertiserById(advId);
        if (adv) {
          if (idxOrganizador !== -1) {
            const cur = String(row[idxOrganizador] || '').trim();
            const advName = adv._name_from_B !== undefined ? adv._name_from_B : (adv.nombre || adv.nombre_comercio || adv.b || '');
            if (!cur && advName) { out[i][idxOrganizador] = advName; changed = true; }
          }
          if (idxLogoOrganizador !== -1) {
            const curL = String(row[idxLogoOrganizador] || '').trim();
            const advLogo = adv._logo_from_AY !== undefined ? adv._logo_from_AY : (adv.logo || adv.imagen || adv.logo_url || '');
            if (!curL && advLogo) { out[i][idxLogoOrganizador] = advLogo; changed = true; }
          }
        }
      }
    }

    if (idxLugar !== -1) {
      const lugarVal = row[idxLugar];
      if (lugarVal) {
        const info = lugaresMap[_norm(lugarVal)];
        if (info) {
          if (idxDir !== -1 && (!row[idxDir] || String(row[idxDir]).trim() === '')) { out[i][idxDir] = info.direccion || ''; changed = true; }
          if (idxLlegar !== -1 && (!row[idxLlegar] || String(row[idxLlegar]).trim() === '')) { out[i][idxLlegar] = info.llegar || ''; changed = true; }
        }
      }
    }

    if (idxCategoria !== -1 && idxLogoCategoria !== -1) {
      const catVal = String(row[idxCategoria] || '').trim();
      if (catVal && (!row[idxLogoCategoria] || String(row[idxLogoCategoria]).trim() === '')) {
        const url = findLogoForCategory(catVal, headersCat);
        if (url) { out[i][idxLogoCategoria] = url; changed = true; }
      }
    }

    for (let j=0;j<partnerIdx.length;j++){
      const pIdx = partnerIdx[j];
      const lpIdx = logoPartnerIdx[j];
      if (pIdx === -1 || lpIdx === -1) continue;
      const pVal = String(row[pIdx] || '').trim();
      if (pVal && (!row[lpIdx] || String(row[lpIdx]).trim() === '')) {
        const logo = partnerLogoMap[_norm(pVal)] || '';
        if (logo) { out[i][lpIdx] = logo; changed = true; }
      }
    }

    if (changed) enriched++;
  }

  if (enriched > 0) sh.getRange(2,1,rows,headers.length).setValues(out);
  return { enriched, checked: rows };
}

/* ---------- ENRIQUECIMIENTO DE HOJAS ORIGEN (VIP/FREE) ---------- */
function enrichSourceSheetFromLists(sheetName){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { enriched:0, checked:0, sheet: sheetName, reason:'no sheet' };

  const headers = getHeaders(sh);
  if (!headers.length) return { enriched:0, checked:0, sheet: sheetName };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { enriched:0, checked:0, sheet: sheetName };

  const lugaresMap = {};
  const lugaresSh = ss.getSheetByName(LUGARES_LIST_SHEET);
  if (lugaresSh && lugaresSh.getLastRow() >= 2) {
    const vals = lugaresSh.getRange(2,1,lugaresSh.getLastRow()-1,3).getValues();
    for (const r of vals) {
      const name = _norm(r[0] || '');
      if (!name) continue;
      lugaresMap[name] = { direccion: r[1] || '', llegar: r[2] || '' };
    }
  }

  const partnerLogoMap = {};
  const partnerSh = ss.getSheetByName(PARTNER_LIST_SHEET);
  if (partnerSh && partnerSh.getLastRow() >= 2) {
    const vals = partnerSh.getRange(2,1,partnerSh.getLastRow()-1,2).getValues();
    for (const r of vals) {
      const name = _norm(r[0] || '');
      if (!name) continue;
      partnerLogoMap[name] = r[1] || '';
    }
  }

  const idxLugar = headers.indexOf('lugar');
  const idxDir = headers.indexOf('direccion');
  const idxLlegar = headers.indexOf('llegar');
  const idxCategoria = headers.indexOf('categoria');
  const idxLogoCategoria = headers.indexOf('logo_categoria');
  const idxIdAnunciante = headers.indexOf('id_anunciante');
  const idxOrganizador = headers.indexOf('organizador');
  const idxLogoOrganizador = headers.indexOf('logo_organizador');

  const partnerIdx = [];
  const logoPartnerIdx = [];
  for (let i=1;i<=6;i++){
    partnerIdx.push(headers.indexOf(i===1 ? 'partner' : 'partner'+i));
    logoPartnerIdx.push(headers.indexOf(i===1 ? 'logo_partner' : 'logo_partner'+i));
  }

  const data = sh.getRange(2,1,rows,headers.length).getValues();
  const out = data.map(r => r.slice());
  let enriched = 0;

  for (let i=0;i<data.length;i++){
    const row = data[i];
    let changed = false;

    if (idxIdAnunciante !== -1) {
      const advId = String(row[idxIdAnunciante] || '').trim();
      if (advId) {
        const adv = getAdvertiserById(advId);
        if (adv) {
          if (idxOrganizador !== -1) {
            const cur = String(row[idxOrganizador] || '').trim();
            const advName = adv._name_from_B !== undefined ? adv._name_from_B : (adv.nombre || adv.nombre_comercio || adv.b || '');
            if (!cur && advName) { out[i][idxOrganizador] = advName; changed = true; }
          }
          if (idxLogoOrganizador !== -1) {
            const curL = String(row[idxLogoOrganizador] || '').trim();
            const advLogo = adv._logo_from_AY !== undefined ? adv._logo_from_AY : (adv.logo || adv.imagen || adv.logo_url || '');
            if (!curL && advLogo) { out[i][idxLogoOrganizador] = advLogo; changed = true; }
          }
        }
      }
    }

    if (idxLugar !== -1) {
      const lugarVal = row[idxLugar];
      if (lugarVal) {
        const info = lugaresMap[_norm(lugarVal)];
        if (info) {
          if (idxDir !== -1 && (!row[idxDir] || String(row[idxDir]).trim() === '')) { out[i][idxDir] = info.direccion || ''; changed = true; }
          if (idxLlegar !== -1 && (!row[idxLlegar] || String(row[idxLlegar]).trim() === '')) { out[i][idxLlegar] = info.llegar || ''; changed = true; }
        }
      }
    }

    if (idxCategoria !== -1 && idxLogoCategoria !== -1) {
      const catVal = String(row[idxCategoria] || '').trim();
      if (catVal && (!row[idxLogoCategoria] || String(row[idxLogoCategoria]).trim() === '')) {
        const url = findLogoForCategory(catVal);
        if (url) { out[i][idxLogoCategoria] = url; changed = true; }
      }
    }

    for (let j=0;j<partnerIdx.length;j++){
      const pIdx = partnerIdx[j];
      const lpIdx = logoPartnerIdx[j];
      if (pIdx === -1 || lpIdx === -1) continue;
      const pVal = String(row[pIdx] || '').trim();
      if (pVal && (!row[lpIdx] || String(row[lpIdx]).trim() === '')) {
        const logo = partnerLogoMap[_norm(pVal)] || '';
        if (logo) { out[i][lpIdx] = logo; changed = true; }
      }
    }

    if (changed) enriched++;
  }

  if (enriched > 0) sh.getRange(2,1,rows,headers.length).setValues(out);
  return { enriched, checked: rows, sheet: sheetName };
}

/* ---------- CREAR Y ASEGURAR HOJAS / IMPORTRANGE ---------- */
function ensureEventsSheetAndHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(EVENTS_SHEET_NAME);
  const desired = EVENTS_HEADERS.length;
  const currentCols = Math.max(1, sh.getLastColumn());
  if (currentCols < desired) sh.insertColumnsAfter(currentCols, desired - currentCols);
  sh.getRange(1,1,1,desired).setValues([EVENTS_HEADERS]);

  // ✅ FIX: NO pre-crear 200 filas vacías
  try {
    const startRow = 2;
    const minRowsNeeded = 2;
    if (sh.getMaxRows() < minRowsNeeded) {
      sh.insertRowsAfter(sh.getMaxRows(), minRowsNeeded - sh.getMaxRows());
    }

    const rows = Math.max(0, sh.getLastRow() - 1);
    const checkboxRows = Math.max(1, rows + 5);
    const maxPossible = Math.max(0, sh.getMaxRows() - 1);
    const finalRows = Math.min(checkboxRows, maxPossible);

    if (finalRows > 0) {
      const checkboxRange = sh.getRange(startRow, 1, finalRows, 1);
      checkboxRange.insertCheckboxes();
      const currentVals = checkboxRange.getValues();
      const toWrite = [];
      let needWrite = false;
      for (let i=0;i<currentVals.length;i++){
        const v = currentVals[i][0];
        if (v === '' || v === null) { toWrite.push([false]); needWrite = true; }
        else toWrite.push([v]);
      }
      if (needWrite) checkboxRange.setValues(toWrite);
    }
  } catch(e){
    console.warn('ensureEventsSheetAndHeaders: checkbox insertion failed', e);
  }

  try {
    const headers = getHeaders(sh);
    const catIdx = headers.indexOf('categoria');
    if (catIdx !== -1) {
      const startRow = 2;
      const maxRows = Math.max(1, sh.getMaxRows() - startRow + 1);
      if (maxRows > 0) sh.getRange(startRow, catIdx + 1, maxRows, 1).clearDataValidations();
    }
  } catch (e) {
    console.warn('ensureEventsSheetAndHeaders: clearing category validations failed', e);
  }

  return sh;
}

function ensureAnunciantesImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(IMPORT_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(IMPORT_SHEET_NAME);
  const sep = (ss.getSpreadsheetLocale()||'').toLowerCase().startsWith('en') ? ',' : ';';
  sh.getRange('A1').setFormula('=IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ANNUNCIANTES_ID + '"' + sep + '"' + 'anunciantes!A:ZZ")');
  return sh;
}

/* ---------- ENSURE VIP SHEET & validations ---------- */
function ensureVipSheetAndHeaders(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(VIP_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(VIP_SHEET_NAME);

  const desired = VIP_HEADERS.length;
  const currentCols = Math.max(1, sh.getLastColumn());
  if (currentCols < desired) sh.insertColumnsAfter(currentCols, desired - currentCols);

  // Migración suave: detectar headers existentes
  const existingHeaders = sh.getLastRow() >= 1 ? sh.getRange(1,1,1,currentCols).getValues()[0].map(h => String(h||'').toLowerCase().trim()) : [];
  const needsUpdate = existingHeaders.length === 0 || 
                      existingHeaders.indexOf('evento_id') === -1 || 
                      existingHeaders.indexOf('pausado') === -1;
  
  // Si no existen evento_id o pausado, o si están en orden incorrecto, reescribir headers
  if (needsUpdate) {
    sh.getRange(1,1,1,desired).setValues([VIP_HEADERS]);
  } else {
    // Headers ya existen - verificar que evento_id esté antes de pausado
    const idxEventoId = existingHeaders.indexOf('evento_id');
    const idxPausado = existingHeaders.indexOf('pausado');
    
    // Si están en orden incorrecto (pausado antes de evento_id), corregir
    if (idxEventoId !== -1 && idxPausado !== -1 && idxPausado < idxEventoId) {
      // Reescribir con orden correcto
      sh.getRange(1,1,1,desired).setValues([VIP_HEADERS]);
    }
  }

  try {
    const catSh = ss.getSheetByName(CATEGORIES_SHEET_NAME);
    if (catSh && catSh.getLastRow() >= 2) {
      const catRange = catSh.getRange(2,1,Math.max(1,catSh.getLastRow()-1),1);
      const colIdx = VIP_HEADERS.indexOf('categoria') + 1;
      if (colIdx > 0) {
        const targetRange = sh.getRange(2, colIdx, Math.max(0, sh.getMaxRows()-1),1);
        const rule = SpreadsheetApp.newDataValidation().requireValueInRange(catRange, true).setAllowInvalid(false).build();
        targetRange.setDataValidation(rule);
      }
    }

    const locSh = ss.getSheetByName(LOCALIDAD_LIST_SHEET);
    if (locSh && locSh.getLastRow() >= 2) {
      const locRange = locSh.getRange(2,1,Math.max(1,locSh.getLastRow()-1),1);
      const colIdx = VIP_HEADERS.indexOf('localidad') + 1;
      if (colIdx > 0) {
        const targetRange = sh.getRange(2, colIdx, Math.max(0, sh.getMaxRows()-1),1);
        const rule = SpreadsheetApp.newDataValidation().requireValueInRange(locRange, true).setAllowInvalid(false).build();
        targetRange.setDataValidation(rule);
      }
    }

    const lugaresSh = ss.getSheetByName(LUGARES_LIST_SHEET);
    if (lugaresSh && lugaresSh.getLastRow() >= 2) {
      const lugRange = lugaresSh.getRange(2,1,Math.max(1,lugaresSh.getLastRow()-1),1);
      const colIdx = VIP_HEADERS.indexOf('lugar') + 1;
      if (colIdx > 0) {
        const targetRange = sh.getRange(2, colIdx, Math.max(0, sh.getMaxRows()-1),1);
        const rule = SpreadsheetApp.newDataValidation().requireValueInRange(lugRange, true).setAllowInvalid(false).build();
        targetRange.setDataValidation(rule);
      }
    }

    const partnerSh = ss.getSheetByName(PARTNER_LIST_SHEET);
    if (partnerSh && partnerSh.getLastRow() >= 2) {
      const pRange = partnerSh.getRange(2,1,Math.max(1,partnerSh.getLastRow()-1),1);
      for (let i=1;i<=6;i++){
        const partnerName = i === 1 ? 'partner' : ('partner' + i);
        const colIdx = VIP_HEADERS.indexOf(partnerName) + 1;
        if (colIdx > 0) {
          const targetRange = sh.getRange(2, colIdx, Math.max(0, sh.getMaxRows()-1),1);
          const rule = SpreadsheetApp.newDataValidation().requireValueInRange(pRange, true).setAllowInvalid(false).build();
          targetRange.setDataValidation(rule);
        }
      }
    }
  } catch(e){
    console.warn('ensureVipSheetAndHeaders: validation setup failed', e);
  }

  return sh;
}

/* ---------- FIND PLACE & WRITE PLACE DETAILS ---------- */
function findPlaceDetailsSimple(placeName){
  if(!placeName) return { found:false };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(AUX_PLACES_SHEET);
  if(!sh) return { found:false };
  const lastRow = Math.max(1, sh.getLastRow());
  const lastCol = Math.max(1, sh.getLastColumn());
  if (lastRow < 2) return { found:false };

  const rawHeaders = sh.getRange(1,1,1,lastCol).getValues()[0].map(h=>String(h||'').toLowerCase().trim());
  const data = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  const targetNorm = _norm(placeName);

  const idxName = rawHeaders.findIndex(h => /lugar|nombre|venue|site|sede/.test(h));
  const idxDireccion = rawHeaders.findIndex(h => /direccion|address|domicilio/.test(h));
  const idxLlegar = rawHeaders.findIndex(h => /llegar|maps|como_llegar|como llegar|link_maps/.test(h));
  const idxLat = rawHeaders.findIndex(h => /lat|latitude|latitud/.test(h));
  const idxLng = rawHeaders.findIndex(h => /lng|lon|long|longitude|longitud/.test(h));

  for (let r=0; r<data.length; r++){
    const candidate = (idxName !== -1 && idxName < data[r].length) ? String(data[r][idxName]||'') : '';
    if (_norm(candidate) === targetNorm) {
      return {
        found: true,
        lugar: candidate || placeName,
        direccion: (idxDireccion !== -1 && idxDireccion < data[r].length) ? String(data[r][idxDireccion]||'') : '',
        llegar: (idxLlegar !== -1 && idxLlegar < data[r].length) ? String(data[r][idxLlegar]||'') : '',
        lat: (idxLat !== -1 && idxLat < data[r].length) ? data[r][idxLat] : '',
        lng: (idxLng !== -1 && idxLng < data[r].length) ? data[r][idxLng] : '',
        sourceRow: r+2
      };
    }
  }
  return { found:false };
}
function writePlaceDetailsToRow(sheet, targetRowIndex, details){
  if(!sheet || !targetRowIndex || !details) return;
  const headers = getHeaders(sheet);
  function setIf(namesArr, value){
    for(const n of namesArr){
      const idx = headers.indexOf(n);
      if (idx !== -1) {
        sheet.getRange(targetRowIndex, idx+1).setValue(value);
        return true;
      }
    }
    return false;
  }
  setIf(['direccion','address','domicilio'], details.direccion || '');
  setIf(['llegar','como_llegar','maps'], details.llegar || '');
  if (details.lat !== undefined) setIf(['lat','latitude','latitud'], details.lat);
  if (details.lng !== undefined) setIf(['lng','lon','long','longitude','longitud'], details.lng);
}

/* ---------- findLogoForCategory ---------- */
function findLogoForCategory(title, catSh) {
  title = String(title || '').trim();
  if (!title) return '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!catSh) catSh = ss.getSheetByName(CATEGORIES_SHEET_NAME);
  if (!catSh) return '';
  const last = Math.max(1, catSh.getLastRow());
  if (last < 2) return '';
  const vals = catSh.getRange(2,1,last-1,Math.max(1,catSh.getLastColumn())).getValues();
  for (let i=0;i<vals.length;i++){
    if (String(vals[i][0] || '').trim() === title) return String(vals[i][1] || '').trim();
  }
  return '';
}

/* ---------- getAdvertiserById ---------- */
function getAdvertiserById(id) {
  if (!id) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const annSh = ss.getSheetByName(IMPORT_SHEET_NAME) || ss.getSheetByName('anunciantes_import') || ss.getSheetByName('anunciantes');
  if (!annSh) return null;
  const lastRow = Math.max(1, annSh.getLastRow());
  const lastCol = Math.max(1, annSh.getLastColumn());
  if (lastRow < 2) return null;

  const hdrsRaw = annSh.getRange(1,1,1,lastCol).getValues()[0];
  const hdrs = hdrsRaw.map(h => String(h||'').toLowerCase().trim());
  const data = annSh.getRange(2,1,lastRow-1,lastCol).getValues();

  function findHeaderIndex(names) {
    for (const n of names) {
      const idx = hdrs.indexOf(n);
      if (idx !== -1) return idx + 1;
    }
    return -1;
  }

  const idHeaderCandidates = ['id','planilla_id','codigo','bk','codigo_anunciante','anunciante_id'];
  const nameHeaderCandidates = ['nombre','nombre_comercio','name','empresa','razon_social','b'];
  const logoHeaderCandidates = ['logo','imagen','image','logo_url','img','ay'];

  const idColByHeader = findHeaderIndex(idHeaderCandidates);
  const nameColByHeader = findHeaderIndex(nameHeaderCandidates);
  const logoColByHeader = findHeaderIndex(logoHeaderCandidates);

  const fallbackBK = 63; // BK
  const fallbackB = 2;   // B
  const fallbackAY = 51; // AY

  const idCol = (idColByHeader !== -1) ? idColByHeader : ((lastCol >= fallbackBK) ? fallbackBK : -1);
  const nameCol = (nameColByHeader !== -1) ? nameColByHeader : ((lastCol >= fallbackB) ? fallbackB : -1);
  const logoCol = (logoColByHeader !== -1) ? logoColByHeader : ((lastCol >= fallbackAY) ? fallbackAY : -1);

  if (idCol !== -1) {
    for (let r=0; r<data.length; r++) {
      const cell = String(data[r][idCol - 1] || '').trim();
      if (cell && String(cell) === String(id)) {
        const rowObj = {};
        for (let c=0;c<hdrs.length;c++) rowObj[hdrs[c] || ('col'+(c+1))] = data[r][c];
        if (idCol === fallbackBK) rowObj._id_bk = cell;
        if (nameCol !== -1) rowObj._name_from_B = data[r][nameCol - 1];
        if (logoCol !== -1) rowObj._logo_from_AY = data[r][logoCol - 1];
        return rowObj;
      }
    }
  }

  for (let r=0; r<data.length; r++) {
    const rowObj = {};
    for (let c=0;c<hdrs.length;c++) rowObj[hdrs[c] || ('col'+(c+1))] = data[r][c];
    if (idColByHeader !== -1) {
      const v = String(data[r][idColByHeader - 1] || '').trim();
      if (v && String(v) === String(id)) {
        if (nameColByHeader !== -1) rowObj._name_from_B = data[r][nameColByHeader - 1];
        if (logoColByHeader !== -1) rowObj._logo_from_AY = data[r][logoColByHeader - 1];
        return rowObj;
      }
    }
    for (const cand of idHeaderCandidates) {
      if (rowObj[cand] !== undefined && String(rowObj[cand]).trim() === String(id)) {
        if (nameCol !== -1 && rowObj._name_from_B === undefined) rowObj._name_from_B = (nameCol <= lastCol ? data[r][nameCol-1] : undefined);
        if (logoCol !== -1 && rowObj._logo_from_AY === undefined) rowObj._logo_from_AY = (logoCol <= lastCol ? data[r][logoCol-1] : undefined);
        return rowObj;
      }
    }
    for (let c=0;c<hdrs.length;c++){
      if (String(data[r][c]).trim() === String(id)) {
        if (nameCol !== -1) rowObj._name_from_B = data[r][nameCol - 1];
        if (logoCol !== -1) rowObj._logo_from_AY = data[r][logoCol - 1];
        return rowObj;
      }
    }
  }
  return null;
}

/* ---------- Audit write ---------- */
function writeAuditEventRow(sheet, row, action, advertiserId) {
  try {
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const auditText = action + ' via worker at ' + now + ' by ' + advertiserId;
    const headers = getHeaders(sheet);
    let auditIdx = headers.indexOf('audit');
    if (auditIdx === -1) {
      const newCol = Math.max(1, sheet.getLastColumn()) + 1;
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, newCol).setValue('audit');
      auditIdx = newCol - 1;
    }
    const cell = sheet.getRange(row, auditIdx + 1);
    const existing = String(cell.getValue() || '').trim();
    if (!existing) cell.setValue(auditText);
    else cell.setValue(existing + ' | ' + auditText);
  } catch(e){ try { sheet.getRange(row, 1).setValue('audit_error'); } catch(err){} }
}

/* ======================================================================
   CRUD VIP para Dashboard
   ====================================================================== */

function getVipEvents(advertiserId){
  advertiserId = String(advertiserId || '').trim();
  if (!advertiserId) return { events: [], count: 0 };

  const sh = ensureVipSheetAndHeaders();
  const headers = getHeaders(sh);
  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { events: [], count: 0 };

  const idxAdv = headers.indexOf('id_anunciante');
  const data = sh.getRange(2,1,rows,headers.length).getValues();
  const out = [];

  for (let r=0;r<data.length;r++){
    const adv = idxAdv !== -1 ? String(data[r][idxAdv] || '').trim() : '';
    if (adv !== advertiserId) continue;
    const obj = {};
    for (let c=0;c<headers.length;c++) obj[headers[c]] = data[r][c];
    out.push(obj);
  }
  return { events: out, count: out.length };
}

function createVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  if (!advertiserId) return { error: 'advertiserId required' };

  const vipSh = ensureVipSheetAndHeaders();
  const headers = getHeaders(vipSh);
  const row = new Array(headers.length).fill('');

  function setFieldLocal(name, value){
    const idx = headers.indexOf(String(name||'').toLowerCase().trim());
    if (idx !== -1) row[idx] = value;
  }

  setFieldLocal('id_anunciante', advertiserId);
  const newEventoId = _generateEventoId_('vip');
  setFieldLocal('evento_id', newEventoId);

  const keys = [
    'organizador','logo_organizador','categoria','logo_categoria','nombre_evento','localidad',
    'lugar','direccion','llegar','fecha','hora','hora2','descripcion','instagram',
    'img1','img2','img3','entradas',
    'partner','logo_partner','partner2','logo_partner2','partner3','logo_partner3',
    'partner4','logo_partner4','partner5','logo_partner5','partner6','logo_partner6'
  ];

  keys.forEach(k => {
    let val = payload[k] || '';
    if (k === 'hora' || k === 'hora2') val = normalizeTimeText_(val);
    if (k === 'fecha') val = normalizeDateText_(val);
    setFieldLocal(k, val);
  });

  // Establecer pausado en FALSE por defecto
  setFieldLocal('pausado', 'FALSE');

  setFieldLocal('audit', 'created_vip_event at ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));

  vipSh.appendRow(row);
  const newRow = vipSh.getLastRow();

  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { syncUnificadaFromSources(); } catch(e){}

  return { success:true, created:true, evento_id: newEventoId, row: newRow };
}

function updateVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const eventoId = String(payload.evento_id || '').trim();

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!eventoId) return { error: 'evento_id required' };

  const sh = ensureVipSheetAndHeaders();
  const headers = getHeaders(sh);
  const idxEvento = headers.indexOf('evento_id');
  const idxAdv = headers.indexOf('id_anunciante');

  if (idxEvento === -1) return { error: 'VIP missing evento_id column' };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { error: 'no vip events' };
  const data = sh.getRange(2,1,rows,headers.length).getValues();

  let foundRow = -1;
  for (let r=0;r<data.length;r++){
    const eid = String(data[r][idxEvento] || '').trim();
    if (eid !== eventoId) continue;
    const adv = idxAdv !== -1 ? String(data[r][idxAdv] || '').trim() : '';
    if (adv !== advertiserId) return { error: 'event belongs to another advertiser' };
    foundRow = r + 2;
    break;
  }
  if (foundRow === -1) return { error: 'event not found' };

  const allowed = new Set([
    'organizador','logo_organizador','categoria','logo_categoria','nombre_evento','localidad',
    'lugar','direccion','llegar','fecha','hora','hora2','descripcion','instagram',
    'img1','img2','img3','entradas',
    'partner','logo_partner','partner2','logo_partner2','partner3','logo_partner3',
    'partner4','logo_partner4','partner5','logo_partner5','partner6','logo_partner6'
  ]);

  for (const k in payload){
    const key = String(k||'').toLowerCase().trim();
    if (!allowed.has(key)) continue;
    const idx = headers.indexOf(key);
    if (idx === -1) continue;

    let val = payload[k];
    if (key === 'hora' || key === 'hora2') val = normalizeTimeText_(val);
    if (key === 'fecha') val = normalizeDateText_(val);

    sh.getRange(foundRow, idx+1).setValue(val);
  }

  try {
    const catIdx = headers.indexOf('categoria');
    const logoCatIdx = headers.indexOf('logo_categoria');
    if (catIdx !== -1 && logoCatIdx !== -1) {
      const catVal = String(sh.getRange(foundRow, catIdx+1).getValue() || '').trim();
      const curLogo = String(sh.getRange(foundRow, logoCatIdx+1).getValue() || '').trim();
      if (catVal && !curLogo) {
        const url = findLogoForCategory(catVal);
        if (url) sh.getRange(foundRow, logoCatIdx+1).setValue(url);
      }
    }
  } catch(e){}

  writeAuditEventRow(sh, foundRow, 'update_vip', advertiserId);

  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { syncUnificadaFromSources(); } catch(e){}

  return { success:true, updated:true, evento_id: eventoId, row: foundRow };
}

function deleteVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const eventoId = String(payload.evento_id || '').trim();

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!eventoId) return { error: 'evento_id required' };

  const sh = ensureVipSheetAndHeaders();
  const headers = getHeaders(sh);
  const idxEvento = headers.indexOf('evento_id');
  const idxAdv = headers.indexOf('id_anunciante');
  if (idxEvento === -1) return { error: 'VIP missing evento_id column' };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { error: 'no vip events' };
  const data = sh.getRange(2,1,rows,headers.length).getValues();

  for (let r=0;r<data.length;r++){
    const eid = String(data[r][idxEvento] || '').trim();
    if (eid !== eventoId) continue;
    const adv = idxAdv !== -1 ? String(data[r][idxAdv] || '').trim() : '';
    if (adv !== advertiserId) return { error: 'event belongs to another advertiser' };

    sh.deleteRow(r + 2);

    try { syncUnificadaFromSources(); } catch(e){}

    return { success:true, deleted:true, evento_id: eventoId };
  }

  return { error: 'event not found' };
}

/**
 * Pausa o reanuda un evento VIP
 * @param {string} advertiserId - ID del anunciante
 * @param {object} payload - { evento_id, pause: true|false }
 * @returns {object} - { success, paused } o { error }
 */
function pauseVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const eventoId = String(payload.evento_id || '').trim();
  const pauseValue = payload.pause === true || payload.pause === 'true' || payload.pause === 'TRUE';

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!eventoId) return { error: 'evento_id required' };

  const sh = ensureVipSheetAndHeaders();
  const headers = getHeaders(sh);
  const idxEvento = headers.indexOf('evento_id');
  const idxAdv = headers.indexOf('id_anunciante');
  const idxPausado = headers.indexOf('pausado');

  if (idxEvento === -1) return { error: 'VIP missing evento_id column' };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { error: 'no vip events' };
  const data = sh.getRange(2,1,rows,headers.length).getValues();

  for (let r=0;r<data.length;r++){
    const eid = String(data[r][idxEvento] || '').trim();
    if (eid !== eventoId) continue;
    const adv = idxAdv !== -1 ? String(data[r][idxAdv] || '').trim() : '';
    if (adv !== advertiserId) return { error: 'event belongs to another advertiser' };

    // Escribir en columna pausado
    if (idxPausado !== -1) {
      sh.getRange(r + 2, idxPausado + 1).setValue(pauseValue ? 'TRUE' : 'FALSE');
    }

    // Escribir audit
    writeAuditEventRow(sh, r + 2, pauseValue ? 'pause_vip' : 'resume_vip', advertiserId);

    // Sincronizar a unificada
    try { syncUnificadaFromSources(); } catch(e){}

    return { success:true, paused: pauseValue, evento_id: eventoId };
  }

  return { error: 'event not found' };
}

/* ---------- EVENTS CRUD (compat) ---------- */
function createEvent(advertiserId, payload) {
  if (!advertiserId) return { error: 'advertiserId required' };
  if (!payload || typeof payload !== 'object') payload = {};

  const vipSh = ensureVipSheetAndHeaders();
  const headers = getHeaders(vipSh);
  const row = new Array(headers.length).fill('');

  function setFieldLocal(name, value){
    const idx = headers.indexOf(String(name||'').toLowerCase().trim());
    if (idx !== -1) row[idx] = value;
  }

  setFieldLocal('id_anunciante', advertiserId);
  setFieldLocal('organizador', payload.organizador || '');
  setFieldLocal('logo_organizador', payload.logo_organizador || '');
  setFieldLocal('categoria', payload.categoria || '');
  setFieldLocal('logo_categoria', payload.logo_categoria || '');
  setFieldLocal('nombre_evento', payload.nombre_evento || payload.nombre || '');
  setFieldLocal('localidad', payload.localidad || '');
  setFieldLocal('lugar', payload.lugar || '');
  setFieldLocal('direccion', payload.direccion || '');
  setFieldLocal('llegar', payload.llegar || '');

  setFieldLocal('fecha', normalizeDateText_(payload.fecha || ''));
  setFieldLocal('hora', normalizeTimeText_(payload.hora || ''));
  setFieldLocal('hora2', normalizeTimeText_(payload.hora2 || ''));

  setFieldLocal('descripcion', payload.descripcion || '');
  setFieldLocal('instagram', payload.instagram || '');
  setFieldLocal('img1', payload.img1 || '');
  setFieldLocal('img2', payload.img2 || '');
  setFieldLocal('img3', payload.img3 || '');
  setFieldLocal('entradas', payload.entradas || '');
  for (let i=1;i<=6;i++){
    const p = i===1 ? 'partner' : 'partner'+i;
    const lp = i===1 ? 'logo_partner' : ('logo_partner' + i);
    setFieldLocal(p, payload[p] || '');
    setFieldLocal(lp, payload[lp] || '');
  }

  setFieldLocal('audit', 'created_by:dashboard at ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));

  vipSh.appendRow(row);
  const newRow = vipSh.getLastRow();

  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { syncUnificadaFromSources(); } catch(e){}

  return { success:true, created:true, sheet: VIP_SHEET_NAME, row: newRow };
}

function updateEvent(advertiserId, payload) {
  if (!advertiserId) return { error: 'advertiserId required' };
  if (!payload || !payload.evento_id) return { error: 'evento_id required for update' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { error: 'events sheet missing' };
  const headers = getHeaders(sh);
  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { error: 'no events' };
  const idCol = headers.indexOf('evento_id');
  const data = sh.getRange(2,1,rows,headers.length).getValues();
  let found = -1;
  for (let r=0;r<data.length;r++){
    const rowId = String(data[r][idCol] || '');
    const rowAdv = (headers.indexOf('id_anunciante') !== -1) ? String(data[r][headers.indexOf('id_anunciante')] || '') : '';
    if (rowId === String(payload.evento_id) && (rowAdv === String(advertiserId) || !rowAdv)) { found = r + 2; break; }
  }
  if (found === -1) return { error: 'event not found or mismatch advertiser' };

  const allowed = ['nombre_evento','fecha','hora','hora2','lugar','localidad','descripcion','entradas','img1','img2','img3','categoria','instagram','partner','logo_partner'];
  for (const k in payload) {
    const key = String(k).toLowerCase().trim();
    if (allowed.indexOf(key) === -1) continue;
    const idx = headers.indexOf(key);
    if (idx === -1) continue;

    let val = payload[k];
    if (key === 'hora' || key === 'hora2') val = normalizeTimeText_(val);
    if (key === 'fecha') val = normalizeDateText_(val);

    sh.getRange(found, idx+1).setValue(val);
  }

  try {
    const catIdx = headers.indexOf('categoria');
    const logoCatIdx = headers.indexOf('logo_categoria');
    if (catIdx !== -1) {
      const catVal = String(sh.getRange(found, catIdx+1).getValue() || '').trim();
      if (catVal && logoCatIdx !== -1) {
        const url = findLogoForCategory(catVal);
        if (url) sh.getRange(found, logoCatIdx+1).setValue(url);
      }
    }
  } catch(e){}

  try {
    if (payload.lugar) {
      const details = findPlaceDetailsSimple(payload.lugar);
      if (details && details.found) writePlaceDetailsToRow(sh, found, details);
    }
  } catch(e){}

  writeAuditEventRow(sh, found, 'update', advertiserId);
  return { success:true, updated:true, row: found };
}

function deleteEvent(advertiserId, payload) {
  if (!advertiserId) return { error: 'advertiserId required' };
  if (!payload || !payload.evento_id) return { error: 'evento_id required for delete' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { error: 'events sheet missing' };
  const headers = getHeaders(sh);
  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { error: 'no events' };
  const idCol = headers.indexOf('evento_id');
  const data = sh.getRange(2,1,rows,headers.length).getValues();
  for (let r=0;r<data.length;r++){
    const rowId = String(data[r][idCol] || '');
    const rowAdv = (headers.indexOf('id_anunciante') !== -1) ? String(data[r][headers.indexOf('id_anunciante')] || '') : '';
    if (rowId === String(payload.evento_id) && (rowAdv === String(advertiserId) || !rowAdv)) {
      sh.deleteRow(r + 2);
      return { success:true, deleted:true };
    }
  }
  return { error: 'event not found or mismatch advertiser' };
}

function pauseEvent(advertiserId, payload) {
  if (!advertiserId) return { error: 'advertiserId required' };
  if (!payload || !payload.evento_id) return { error: 'evento_id required for pause' };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { error: 'events sheet missing' };
  const headers = getHeaders(sh);
  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { error: 'no events' };
  const idCol = headers.indexOf('evento_id');
  const pausedCol = headers.indexOf('pausado');
  const data = sh.getRange(2,1,rows,headers.length).getValues();
  for (let r=0;r<data.length;r++){
    const rowId = String(data[r][idCol] || '');
    const rowAdv = (headers.indexOf('id_anunciante') !== -1) ? String(data[r][headers.indexOf('id_anunciante')] || '') : '';
    if (rowId === String(payload.evento_id) && (rowAdv === String(advertiserId) || !rowAdv)) {
      let destCol = pausedCol;
      if (destCol === -1) {
        const newColIndex = Math.max(1, sh.getLastColumn()) + 1;
        sh.insertColumnAfter(sh.getLastColumn());
        sh.getRange(1, newColIndex).setValue('pausado');
        destCol = newColIndex - 1;
      }
      sh.getRange(r + 2, destCol + 1).setValue(payload.pause ? 'TRUE' : 'FALSE');
      writeAuditEventRow(sh, r + 2, payload.pause ? 'pause' : 'resume', advertiserId);
      return { success:true, paused: !!payload.pause };
    }
  }
  return { error:'event not found or mismatch advertiser' };
}

/* ---------- FORMATTING HELPERS ---------- */
function fechaHumana(valor) {
  if (!valor) return "";
  valor = String(valor).trim();
  let m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return formatoFechaEsp(new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10)));
  m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return formatoFechaEsp(new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10)));
  m = valor.match(/^Date\((\d{4}),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+))?/);
  if (m) return formatoFechaEsp(new Date(parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10)));
  const parsed = new Date(valor);
  if (!isNaN(parsed.getTime())) return formatoFechaEsp(parsed);
  return valor;
}
function formatoFechaEsp(fecha){
  const dias = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}
function horaHumana(h) {
  if (!h) return "";
  const hhmm = normalizeTimeText_(h);
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (m) return `${m[1]}:${m[2]} hs`;
  return hhmm;
}
function horaUnificadaObj(obj) {
  const h2 = obj && obj.hora2 ? String(obj.hora2||'').trim() : '';
  const h1 = obj && obj.hora ? String(obj.hora||'').trim() : '';
  const chosen = h2 !== '' ? h2 : h1;
  return chosen ? horaHumana(chosen) : '';
}

/* ---------- getEventsForAdvertiserWS / Formatted ---------- */
function getEventsForAdvertiserWS(advertiserId) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { events: [] };
  const headers = getHeaders(sh);
  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { events: [] };
  const data = sh.getRange(2,1,rows,headers.length).getValues();
  const out = [];
  for (let r=0;r<data.length;r++){
    const obj = {};
    for (let c=0;c<headers.length;c++) obj[headers[c]] = data[r][c];

    if (obj.hora !== undefined) obj.hora = normalizeTimeText_(obj.hora);
    if (obj.hora2 !== undefined) obj.hora2 = normalizeTimeText_(obj.hora2);

    if (advertiserId) {
      if (String(obj.id_anunciante || '') === String(advertiserId)) out.push(obj);
    } else {
      const apro = String(obj.aprobado || '').toLowerCase();
      const paus = String(obj.pausado || '').toLowerCase();
      if ((apro === 'true' || apro === '1' || apro === 'si' || apro === 'yes') && !(paus === 'true' || paus === '1' || paus === 'si')) out.push(obj);
    }
  }
  return { events: out };
}
function getEventsFormattedForAdvertiser(advertiserId, options) {
  options = options || {};
  const base = getEventsForAdvertiserWS(advertiserId);
  const evs = base.events || [];
  const formatted = evs.map(e => {
    const copy = Object.assign({}, e);
    const fechaVal = (copy.fecha && String(copy.fecha).trim()) ? String(copy.fecha).trim() : (copy.fecha_iso ? String(copy.fecha_iso) : '');
    copy.fecha_humana = fechaHumana(fechaVal);
    copy.hora_unificada = horaUnificadaObj(copy);
    return copy;
  });
  return { events: formatted, count: formatted.length };
}

/* ---------- Router ---------- */
function handleEventAction(action, advertiserId, payload, params) {
  const act = String(action||'').trim().replace(/\s+/g,'').replace(/-+/g,'_').toLowerCase();
  if (act === 'createevent' || act === 'create_event' || act === 'create-event') return createEvent(advertiserId, payload || {});
  if (act === 'updateevent' || act === 'update_event' || act === 'update-event') return updateEvent(advertiserId, payload || {});
  if (act === 'deleteevent' || act === 'delete_event' || act === 'delete-event') return deleteEvent(advertiserId, payload || {});
  if (act === 'pauseevent' || act === 'pause_event' || act === 'pause-event') return pauseEvent(advertiserId, payload || {});
  if (act === 'getevents' || act === 'get_events' || act === 'get-events') {
    const adv = advertiserId || (params && (params.advertiserId || params.id || params.advertiserID)) || '';
    return getEventsForAdvertiserWS(adv);
  }
  if (act === 'geteventsformatted' || act === 'get_events_formatted' || act === 'get-events-formatted') {
    const adv = advertiserId || (params && (params.advertiserId || params.id || params.advertiserID)) || '';
    const includeAll = (params && (params.includeAll === '1' || params.includeAll === 'true')) || false;
    return getEventsFormattedForAdvertiser(adv, { includeAll: includeAll });
  }
  return { error: 'unknown event action: ' + action };
}

/* ---------- WebApp handlers ---------- */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const rawAction = String(params.action || params.accion || '').trim();
    let action = rawAction.replace(/\s+/g,'').replace(/-+/g,'_').toLowerCase();
    const secret = String(params.serverSecret || '');

    const formatParam = (params.format || params.formato || '').toLowerCase();
    if (!action && formatParam === 'human') action = 'geteventsformatted';

    if (!action) {
      if (params.id) {
        if (SECRET_RESTRICTION() && secret !== SERVER_SECRET) return jsonResponse({ error: 'unauthorized' }, 401);
        const adv = getAdvertiserById(params.id);
        if (!adv) return jsonResponse({ error: 'advertiser_not_found', id: params.id }, 404);
        return jsonResponse(Object.assign(adv, { receivedAction: '(implicit getAdvertiser by id)' }));
      }
      action = 'getevents';
    }

    if (SECRET_RESTRICTION() && action !== 'getevents' && secret !== SERVER_SECRET) return jsonResponse({ error: 'unauthorized' }, 401);

    if (action === 'getevents' || action === 'get_events' || action === 'get-events') {
      const advertiserId = params.advertiserId || params.advertiserID || params.id || '';
      return jsonResponse(Object.assign(getEventsForAdvertiserWS(advertiserId), { receivedAction: rawAction || '(implicit getEvents)' }));
    }

    if (action === 'geteventsformatted' || action === 'get_events_formatted' || action === 'get-events-formatted') {
      const advertiserId = params.advertiserId || params.advertiserID || params.id || '';
      const includeAll = (params.includeAll === '1' || params.includeAll === 'true' || params.includeAll === 'yes');
      const resp = getEventsFormattedForAdvertiser(advertiserId, { includeAll: includeAll });
      return jsonResponse(Object.assign(resp, { receivedAction: rawAction || 'getEventsFormatted', includeAll: includeAll }));
    }

    return jsonResponse({ error: 'unknown action', receivedParams: params, hint: 'expected action=getEvents or action=getEventsFormatted or id parameter' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    let body = {};
    try { body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; }
    catch(parseErr) {
      const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
      console.warn('doPost: JSON.parse failed for body, raw:', raw);
      body = { _raw: raw };
    }

    const params = e && e.parameter ? e.parameter : {};
    const advertiserId = body.advertiserId || body.advertiserID || body.__id ||
                         (body.payload && (body.payload.advertiserId || body.payload.advertiserID || body.payload.__id)) ||
                         params.advertiserId || params.id || '';

    const detectedRaw = (body && (body.action || body.accion)) || params.action || params.accion || (body.payload && (body.payload.action || body.payload.accion)) || '';
    const action = String(detectedRaw || '').trim().replace(/\s+/g,'').replace(/-+/g,'_').toLowerCase();

    const secret = String(body.serverSecret || params.serverSecret || '');
    if (SECRET_RESTRICTION() && secret !== SERVER_SECRET) return jsonResponse({ error: 'unauthorized' }, 401);

    if (action === 'getvipevents' || action === 'get_vip_events') return jsonResponse(getVipEvents(advertiserId));
    if (action === 'createvipevent' || action === 'create_vip_event') return jsonResponse(createVipEvent(advertiserId, body.payload || body));
    if (action === 'updatevipevent' || action === 'update_vip_event') return jsonResponse(updateVipEvent(advertiserId, body.payload || body));
    if (action === 'deletevipevent' || action === 'delete_vip_event') return jsonResponse(deleteVipEvent(advertiserId, body.payload || body));
    if (action === 'pausevipevent' || action === 'pause_vip_event') return jsonResponse(pauseVipEvent(advertiserId, body.payload || body));

    if (['createevent','create_event','create-event','updateevent','update_event','update-event','deleteevent','delete_event','pauseevent','pause_event','getevents','get_events','get-events','geteventsformatted','get_events_formatted','get-events-formatted'].indexOf(action) !== -1) {
      return jsonResponse(handleEventAction(action, advertiserId, body.payload || body, params));
    }

    return jsonResponse({ error: 'unknown action', receivedAction: detectedRaw, receivedBody: body, receivedParams: params }, 400);
  } catch(err) {
    console.error('doPost error', err);
    return jsonResponse({ error: err.message }, 500);
  }
}

/* ---------- Sync incremental: unificada (upsert + delete missing) ---------- */
function syncUnificadaFromSources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ✅ NUEVO: asegurar IDs en FREE para que el sync sea estable y se pueda borrar
  const ensureFreeIds = ensureFreeEventoIdColumnAndFill_();

  const enrVip = enrichSourceSheetFromLists(VIP_SHEET_NAME);
  const enrFree = enrichSourceSheetFromLists(FREE_SHEET_NAME);

  const shTarget = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!shTarget) throw new Error("Hoja destino 'unificada' no encontrada. Ejecutá mainSetup() primero.");

  const shVip = ss.getSheetByName(VIP_SHEET_NAME);
  const shFree = ss.getSheetByName(FREE_SHEET_NAME);

  const targetHeaders = getHeaders(shTarget);
  const idxAprobadoTarget = targetHeaders.indexOf('aprobado');
  const idxNivelTarget = targetHeaders.indexOf('nivel');
  const idxEventoTarget = targetHeaders.indexOf('evento_id');
  const idxFechaTarget = targetHeaders.indexOf('fecha');
  const idxHoraTarget = targetHeaders.indexOf('hora');
  const idxHora2Target = targetHeaders.indexOf('hora2');
  if (idxEventoTarget === -1) throw new Error("unificada: falta columna evento_id");

  const aprobadoMap = _buildAprobadoMapFromUnificada_(shTarget, targetHeaders);

  const existingRows = Math.max(0, shTarget.getLastRow() - 1);
  const existingData = existingRows ? shTarget.getRange(2,1,existingRows,targetHeaders.length).getValues() : [];
  const idToRow = {};
  for (let i=0;i<existingData.length;i++){
    const id = String(existingData[i][idxEventoTarget] || '').trim();
    if (id) idToRow[id] = i + 2;
  }

  function readSheetFull(sh) {
    if (!sh) return { rawHeaders: [], rows: [] };
    const lastRow = sh.getLastRow();
    const lastCol = Math.max(1, sh.getLastColumn());
    const rawHeaders = sh.getRange(1,1,1,lastCol).getValues()[0].map(h => String(h||'').toLowerCase().trim());
    if (lastRow < 2) return { rawHeaders, rows: [] };
    const data = sh.getRange(2,1,lastRow-1,lastCol).getValues();
    return { rawHeaders, rows: data };
  }

  const vipFull = readSheetFull(shVip);
  const freeFull = readSheetFull(shFree);

  function getIdFromRawRow(rawHeaders, rowArr) {
    const keys = rawHeaders.map(h => String(h||'').toLowerCase().trim());
    const candidates = ['evento_id','event_id','id'];
    for (const c of candidates) {
      const idx = keys.indexOf(c);
      if (idx !== -1 && rowArr[idx] !== undefined && String(rowArr[idx]).trim() !== '') return String(rowArr[idx]).trim();
    }
    return '';
  }

  const sources = [];
  const seen = {};
  for (let r=0; r<vipFull.rows.length; r++){
    const rowArr = vipFull.rows[r];
    const id = getIdFromRawRow(vipFull.rawHeaders, rowArr) || ('vip-noid-' + (r+1));
    if (!seen[id]) { seen[id] = true; sources.push({ id, source:'vip', row: rowArr, headers: vipFull.rawHeaders }); }
  }
  for (let r=0; r<freeFull.rows.length; r++){
    const rowArr = freeFull.rows[r];
    const id = getIdFromRawRow(freeFull.rawHeaders, rowArr) || ('free-noid-' + (r+1)); // (ya no debería pasar)
    if (!seen[id]) { seen[id] = true; sources.push({ id, source:'free', row: rowArr, headers: freeFull.rawHeaders }); }
  }

  let updated = 0;
  let appended = 0;

  for (const item of sources) {
    const srcRow = item.row;
    const srcHeaders = item.headers;
    const rowOut = new Array(targetHeaders.length).fill('');

    if (idxNivelTarget !== -1) rowOut[idxNivelTarget] = item.source || '';
    rowOut[idxEventoTarget] = String(item.id);

    if (idxAprobadoTarget !== -1) {
      const prev = aprobadoMap[String(item.id)];
      rowOut[idxAprobadoTarget] = (prev === true);
    }

    for (let t = 3; t < targetHeaders.length; t++) {
      const s = t - 3;
      rowOut[t] = (s < srcRow.length) ? (srcRow[s] === undefined ? '' : srcRow[s]) : '';
    }

    // ✅ NUEVO: Copiar pausado si existe en origen (VIP/FREE)
    const idxPausadoTarget = targetHeaders.indexOf('pausado');
    if (idxPausadoTarget !== -1) {
      const idxPausadoSrc = srcHeaders.indexOf('pausado');
      if (idxPausadoSrc !== -1 && srcRow[idxPausadoSrc] !== undefined) {
        rowOut[idxPausadoTarget] = srcRow[idxPausadoSrc];
      }
    }

    if (idxFechaTarget !== -1) rowOut[idxFechaTarget] = normalizeDateText_(rowOut[idxFechaTarget]);
    if (idxHoraTarget !== -1) rowOut[idxHoraTarget] = normalizeTimeText_(rowOut[idxHoraTarget]);
    if (idxHora2Target !== -1) rowOut[idxHora2Target] = normalizeTimeText_(rowOut[idxHora2Target]);

    const existingRowNum = idToRow[String(item.id)];
    if (existingRowNum) {
      shTarget.getRange(existingRowNum, 1, 1, rowOut.length).setValues([rowOut]);
      updated++;
    } else {
      const newRow = appendUnificadaRowSmart_(shTarget, targetHeaders, rowOut);
      appended++;
      idToRow[String(item.id)] = newRow;
    }
  }

  // ✅ NUEVO: BORRAR de unificada lo que ya no existe en VIP/FREE
  const aliveIds = {};
  for (const item of sources) aliveIds[String(item.id)] = true;

  const existingRows2 = Math.max(0, shTarget.getLastRow() - 1);
  const existingData2 = existingRows2 ? shTarget.getRange(2,1,existingRows2,targetHeaders.length).getValues() : [];

  let deleted = 0;
  for (let i = existingData2.length - 1; i >= 0; i--){
    const uid = String(existingData2[i][idxEventoTarget] || '').trim();
    if (!uid) continue;
    if (!aliveIds[uid]) {
      shTarget.deleteRow(i + 2);
      deleted++;
    }
  }

  _ensureAprobadoCheckboxesAndDefaults_(shTarget);

  const purgeResult = purgePastEventsFromUnificada();
  const enrichResult = enrichUnificadaRowsFromLists();

  return {
    vip_source_rows: vipFull.rows.length,
    free_source_rows: freeFull.rows.length,
    updated_existing_rows: updated,
    appended_new_rows: appended,
    deleted_from_unificada_missing_in_sources: deleted,
    purged_past_events: purgeResult,
    enriched_from_lists: enrichResult,
    enriched_vip: enrVip,
    enriched_free: enrFree,
    free_ids_ensure: ensureFreeIds,
    preserved_aprobado_count: Object.keys(aprobadoMap).length
  };
}

/* ---------- Triggers / Auto-sync helpers ---------- */
function syncUnificadaFromSourcesAndLog(){
  const res = syncUnificadaFromSources();
  try { SpreadsheetApp.getActive().toast(
    'Sync upd: ' + (res.updated_existing_rows || 0) +
    ' | new: ' + (res.appended_new_rows || 0) +
    ' | del: ' + (res.deleted_from_unificada_missing_in_sources || 0) +
    ' | purga: ' + (res.purged_past_events ? res.purged_past_events.removed : 0),
    'Sincronización', 6); } catch(e){}
  return res;
}

function _shouldSkipSyncForEdit_(e){
  try {
    const range = e && e.range;
    if (!range) return true;
    const sheet = range.getSheet();
    if (!sheet) return true;

    const sheetName = sheet.getName();
    if (sheetName === EVENTS_SHEET_NAME) return true;
    if (sheetName !== VIP_SHEET_NAME && sheetName !== FREE_SHEET_NAME) return true;
    return false;
  } catch(err){
    return true;
  }
}

function _throttledSync_(reason){
  const THROTTLE_SECONDS = AUTO_SYNC_THROTTLE_SECONDS;
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('LAST_SYNC_TS') || '0');
  const now = Date.now();
  if (now - last < THROTTLE_SECONDS * 1000) return { skipped:true, reason:'throttled' };
  props.setProperty('LAST_SYNC_TS', String(now));
  try {
    const res = syncUnificadaFromSources();
    props.setProperty('LAST_SYNC_REASON', String(reason||''));
    return res;
  } catch (e) {
    props.setProperty('LAST_SYNC_TS', String(0));
    throw e;
  }
}

function onVipEditSync(e){
  if (_shouldSkipSyncForEdit_(e)) return;
  const sheetName = e.range.getSheet().getName();
  if (sheetName !== VIP_SHEET_NAME) return;
  return _throttledSync_('vip_edit');
}

function onFreeEditSync(e){
  if (_shouldSkipSyncForEdit_(e)) return;
  const sheetName = e.range.getSheet().getName();
  if (sheetName !== FREE_SHEET_NAME) return;
  return _throttledSync_('free_edit');
}

/* ---------- SYNC AUX → LIST (B) ---------- */

/**
 * Sincroniza datos de aux_lugares a lugares_list
 * Crea la hoja si no existe, copia headers y contenido, evita duplicados por nombre normalizado
 * @returns {object} - Resultado del sync
 */
function syncAuxLugaresToList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auxSh = ss.getSheetByName(AUX_PLACES_SHEET);
  if (!auxSh) return { error: 'aux_lugares not found', synced: 0 };

  let listSh = ss.getSheetByName(LUGARES_LIST_SHEET);
  if (!listSh) {
    listSh = ss.insertSheet(LUGARES_LIST_SHEET);
  }

  const auxHeaders = getHeaders(auxSh);
  const auxRows = Math.max(0, auxSh.getLastRow() - 1);
  if (auxRows === 0) {
    // Solo copiar headers si aux tiene datos
    if (auxHeaders.length > 0 && listSh.getLastRow() === 0) {
      listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
    }
    return { synced: 0, created_sheet: !ss.getSheetByName(LUGARES_LIST_SHEET) };
  }

  const auxData = auxSh.getRange(2, 1, auxRows, auxHeaders.length).getValues();

  // Escribir headers si la lista está vacía
  if (listSh.getLastRow() === 0) {
    listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
  }

  const listHeaders = getHeaders(listSh);
  const listRows = Math.max(0, listSh.getLastRow() - 1);
  const existingData = listRows > 0 ? listSh.getRange(2, 1, listRows, listHeaders.length).getValues() : [];

  // Construir mapa de nombres normalizados existentes
  const nameIdx = listHeaders.indexOf('nombre') !== -1 ? listHeaders.indexOf('nombre') : 
                  listHeaders.indexOf('lugar') !== -1 ? listHeaders.indexOf('lugar') : 0;
  const existing = new Set();
  for (let i = 0; i < existingData.length; i++) {
    const name = _norm(existingData[i][nameIdx] || '');
    if (name) existing.add(name);
  }

  // Agregar solo nuevos
  let added = 0;
  for (let i = 0; i < auxData.length; i++) {
    const name = _norm(auxData[i][nameIdx] || '');
    if (!name || existing.has(name)) continue;
    listSh.appendRow(auxData[i]);
    existing.add(name);
    added++;
  }

  return { synced: added, total_in_aux: auxRows, total_in_list: listSh.getLastRow() - 1 };
}

/**
 * Sincroniza datos de aux_localidad a localidad_list
 * @returns {object} - Resultado del sync
 */
function syncAuxLocalidadToList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auxSh = ss.getSheetByName(AUX_LOCALIDAD_SHEET);
  if (!auxSh) return { error: 'aux_localidad not found', synced: 0 };

  let listSh = ss.getSheetByName(LOCALIDAD_LIST_SHEET);
  if (!listSh) {
    listSh = ss.insertSheet(LOCALIDAD_LIST_SHEET);
  }

  const auxHeaders = getHeaders(auxSh);
  const auxRows = Math.max(0, auxSh.getLastRow() - 1);
  if (auxRows === 0) {
    if (auxHeaders.length > 0 && listSh.getLastRow() === 0) {
      listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
    }
    return { synced: 0 };
  }

  const auxData = auxSh.getRange(2, 1, auxRows, auxHeaders.length).getValues();

  if (listSh.getLastRow() === 0) {
    listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
  }

  const listHeaders = getHeaders(listSh);
  const listRows = Math.max(0, listSh.getLastRow() - 1);
  const existingData = listRows > 0 ? listSh.getRange(2, 1, listRows, listHeaders.length).getValues() : [];

  const nameIdx = listHeaders.indexOf('nombre') !== -1 ? listHeaders.indexOf('nombre') :
                  listHeaders.indexOf('localidad') !== -1 ? listHeaders.indexOf('localidad') : 0;
  const existing = new Set();
  for (let i = 0; i < existingData.length; i++) {
    const name = _norm(existingData[i][nameIdx] || '');
    if (name) existing.add(name);
  }

  let added = 0;
  for (let i = 0; i < auxData.length; i++) {
    const name = _norm(auxData[i][nameIdx] || '');
    if (!name || existing.has(name)) continue;
    listSh.appendRow(auxData[i]);
    existing.add(name);
    added++;
  }

  return { synced: added, total_in_aux: auxRows, total_in_list: listSh.getLastRow() - 1 };
}

/**
 * Sincroniza datos de aux_partner a partner_list
 * @returns {object} - Resultado del sync
 */
function syncAuxPartnerToList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auxSh = ss.getSheetByName(AUX_PARTNER_SHEET);
  if (!auxSh) return { error: 'aux_partner not found', synced: 0 };

  let listSh = ss.getSheetByName(PARTNER_LIST_SHEET);
  if (!listSh) {
    listSh = ss.insertSheet(PARTNER_LIST_SHEET);
  }

  const auxHeaders = getHeaders(auxSh);
  const auxRows = Math.max(0, auxSh.getLastRow() - 1);
  if (auxRows === 0) {
    if (auxHeaders.length > 0 && listSh.getLastRow() === 0) {
      listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
    }
    return { synced: 0 };
  }

  const auxData = auxSh.getRange(2, 1, auxRows, auxHeaders.length).getValues();

  if (listSh.getLastRow() === 0) {
    listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
  }

  const listHeaders = getHeaders(listSh);
  const listRows = Math.max(0, listSh.getLastRow() - 1);
  const existingData = listRows > 0 ? listSh.getRange(2, 1, listRows, listHeaders.length).getValues() : [];

  const nameIdx = listHeaders.indexOf('nombre') !== -1 ? listHeaders.indexOf('nombre') :
                  listHeaders.indexOf('partner') !== -1 ? listHeaders.indexOf('partner') : 0;
  const existing = new Set();
  for (let i = 0; i < existingData.length; i++) {
    const name = _norm(existingData[i][nameIdx] || '');
    if (name) existing.add(name);
  }

  let added = 0;
  for (let i = 0; i < auxData.length; i++) {
    const name = _norm(auxData[i][nameIdx] || '');
    if (!name || existing.has(name)) continue;
    listSh.appendRow(auxData[i]);
    existing.add(name);
    added++;
  }

  return { synced: added, total_in_aux: auxRows, total_in_list: listSh.getLastRow() - 1 };
}

/**
 * Sincroniza datos de aux_categorias a categorias_list
 * @returns {object} - Resultado del sync
 */
function syncAuxCategoriasToList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const auxSh = ss.getSheetByName(AUX_CATS_SHEET);
  if (!auxSh) return { error: 'aux_categorias not found', synced: 0 };

  let listSh = ss.getSheetByName(CATEGORIES_SHEET_NAME);
  if (!listSh) {
    listSh = ss.insertSheet(CATEGORIES_SHEET_NAME);
  }

  const auxHeaders = getHeaders(auxSh);
  const auxRows = Math.max(0, auxSh.getLastRow() - 1);
  if (auxRows === 0) {
    if (auxHeaders.length > 0 && listSh.getLastRow() === 0) {
      listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
    }
    return { synced: 0 };
  }

  const auxData = auxSh.getRange(2, 1, auxRows, auxHeaders.length).getValues();

  if (listSh.getLastRow() === 0) {
    listSh.getRange(1, 1, 1, auxHeaders.length).setValues([auxHeaders]);
  }

  const listHeaders = getHeaders(listSh);
  const listRows = Math.max(0, listSh.getLastRow() - 1);
  const existingData = listRows > 0 ? listSh.getRange(2, 1, listRows, listHeaders.length).getValues() : [];

  const nameIdx = listHeaders.indexOf('nombre') !== -1 ? listHeaders.indexOf('nombre') :
                  listHeaders.indexOf('categoria') !== -1 ? listHeaders.indexOf('categoria') : 0;
  const existing = new Set();
  for (let i = 0; i < existingData.length; i++) {
    const name = _norm(existingData[i][nameIdx] || '');
    if (name) existing.add(name);
  }

  let added = 0;
  for (let i = 0; i < auxData.length; i++) {
    const name = _norm(auxData[i][nameIdx] || '');
    if (!name || existing.has(name)) continue;
    listSh.appendRow(auxData[i]);
    existing.add(name);
    added++;
  }

  return { synced: added, total_in_aux: auxRows, total_in_list: listSh.getLastRow() - 1 };
}

/**
 * Sincroniza anunciantes desde spreadsheet externo a hoja local anunciantes_aut
 * Filtra solo los anunciantes que tienen la columna 'eventos' (BW) en TRUE
 * @returns {object} - Resultado de la sincronización
 */
function syncAnunciantesAut() {
  try {
    // Abrir el spreadsheet externo
    const extSs = SpreadsheetApp.openById(SPREADSHEET_ANNUNCIANTES_ID);
    const extSh = extSs.getSheetByName('anunciantes');
    
    if (!extSh) {
      return { error: 'No se encontró la pestaña "anunciantes" en el spreadsheet externo', synced: 0 };
    }

    // Leer datos del spreadsheet externo
    const lastRow = extSh.getLastRow();
    if (lastRow < 2) {
      return { error: 'No hay datos en la pestaña anunciantes', synced: 0 };
    }

    const lastCol = extSh.getLastColumn();
    const allData = extSh.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = allData[0];
    
    // Encontrar índice de columna BW (eventos) - columna 75 (BW es la columna 75: A=1, B=2, ..., BW=75)
    const eventosIdx = 74; // BW es la columna 75, índice 74 (base 0)
    
    // Filtrar filas donde eventos = TRUE
    const filteredRows = [];
    for (let i = 1; i < allData.length; i++) {
      const eventosValue = allData[i][eventosIdx];
      // Aceptar boolean true o string "TRUE"
      if (eventosValue === true || eventosValue === 'TRUE' || eventosValue === 'true') {
        filteredRows.push(allData[i]);
      }
    }

    // Obtener/crear hoja local anunciantes_aut
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let localSh = ss.getSheetByName(ANUNCIANTES_AUT_SHEET);
    if (!localSh) {
      localSh = ss.insertSheet(ANUNCIANTES_AUT_SHEET);
    }

    // Limpiar hoja local y escribir headers + datos filtrados
    localSh.clear();
    
    if (filteredRows.length > 0) {
      // Escribir headers
      localSh.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Escribir filas filtradas
      localSh.getRange(2, 1, filteredRows.length, headers.length).setValues(filteredRows);
    } else {
      // Solo headers si no hay datos filtrados
      localSh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    return { 
      synced: filteredRows.length, 
      total_in_source: lastRow - 1,
      message: `Se sincronizaron ${filteredRows.length} anunciantes con eventos=TRUE`
    };
  } catch(e) {
    return { 
      error: e && e.message ? e.message : String(e), 
      synced: 0 
    };
  }
}

/**
 * Sincroniza todas las hojas AUX a sus respectivas LIST
 * @returns {object} - Resultados de todos los syncs
 */
function syncAllAuxToList() {
  const results = {};
  try { results.lugares = syncAuxLugaresToList(); } catch(e) { results.lugares = { error: e.message }; }
  try { results.localidad = syncAuxLocalidadToList(); } catch(e) { results.localidad = { error: e.message }; }
  try { results.partner = syncAuxPartnerToList(); } catch(e) { results.partner = { error: e.message }; }
  try { results.categorias = syncAuxCategoriasToList(); } catch(e) { results.categorias = { error: e.message }; }
  return results;
}

function ensureAutoSyncTriggers(){
  try { ensureOnEditSyncTrigger('onVipEditSync'); } catch(e){}
  try { ensureOnEditSyncTrigger('onFreeEditSync'); } catch(e){}
  try { ensureTimedSyncTrigger(); } catch(e){}
  if (KEEP_HOURLY_MAINTENANCE) {
    try { ensureHourlyMaintenanceTrigger(); } catch(e){}
  }
  // ✅ NUEVO: Trigger para sync aux→list cada 6 horas
  try { ensureAuxListSyncTrigger(); } catch(e){}
  // ✅ NUEVO: Trigger para sync anunciantes_aut cada 6 horas
  try { ensureAnunciantesAutSyncTrigger(); } catch(e){}
}

function ensureOnEditSyncTrigger(handlerName){
  const existing = ScriptApp.getProjectTriggers();
  for (let i=0;i<existing.length;i++){
    if (existing[i].getHandlerFunction() === handlerName && existing[i].getEventType() === ScriptApp.EventType.ON_EDIT) return;
  }
  ScriptApp.newTrigger(handlerName).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}

function ensureTimedSyncTrigger(){
  const existing = ScriptApp.getProjectTriggers();
  for (let i=0;i<existing.length;i++){
    const t = existing[i];
    if (t.getHandlerFunction() === 'scheduledQuickSync' && t.getEventType() === ScriptApp.EventType.TIME_DRIVEN) return;
  }
  ScriptApp.newTrigger('scheduledQuickSync').timeBased().everyMinutes(AUTO_SYNC_TIME_MINUTES).create();
}

function scheduledQuickSync(){
  return _throttledSync_('time_based_quick_sync');
}

function ensureHourlyMaintenanceTrigger(){
  const existing = ScriptApp.getProjectTriggers();
  for (let i=0;i<existing.length;i++){
    const t = existing[i];
    if (t.getHandlerFunction() === 'scheduledHourlyMaintenance' && t.getEventType() === ScriptApp.EventType.TIME_DRIVEN) return;
  }
  ScriptApp.newTrigger('scheduledHourlyMaintenance').timeBased().everyHours(1).create();
}

function scheduledHourlyMaintenance(){
  const res = {};
  try { res.sync = syncUnificadaFromSources(); } catch(e){ res.sync_error = e && e.message ? e.message : String(e); }
  Logger.log('scheduledHourlyMaintenance result: %s', JSON.stringify(res));
  try { SpreadsheetApp.getActive().toast('Auto-mantenimiento: ' + JSON.stringify(res), 'Hourly', 6); } catch(e){}
  return res;
}

/* ---------- TRIGGER AUX LIST SYNC (C) ---------- */

/**
 * Función ejecutada periódicamente para sincronizar hojas AUX a LIST
 * Frecuencia: cada 6 horas (configurable en ensureAuxListSyncTrigger)
 */
function scheduledAuxListSync() {
  const res = {};
  try {
    res.aux_sync = syncAllAuxToList();
    Logger.log('scheduledAuxListSync result: %s', JSON.stringify(res));
  } catch(e) {
    res.error = e && e.message ? e.message : String(e);
    Logger.log('scheduledAuxListSync error: %s', res.error);
  }
  try {
    SpreadsheetApp.getActive().toast(
      'Sync AUX→LIST: ' + JSON.stringify(res.aux_sync || res.error || 'ok'),
      'Aux List Sync',
      6
    );
  } catch(e){}
  return res;
}

/**
 * Asegura que existe el trigger para sincronización periódica AUX→LIST
 * Frecuencia: cada 6 horas
 */
function ensureAuxListSyncTrigger() {
  const existing = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existing.length; i++) {
    const t = existing[i];
    if (t.getHandlerFunction() === 'scheduledAuxListSync' && t.getEventType() === ScriptApp.EventType.TIME_DRIVEN) {
      return; // Ya existe
    }
  }
  // Crear trigger cada 6 horas
  ScriptApp.newTrigger('scheduledAuxListSync').timeBased().everyHours(6).create();
}

/* ---------- TRIGGER ANUNCIANTES_AUT SYNC (D) ---------- */

/**
 * Función ejecutada periódicamente para sincronizar anunciantes_aut desde spreadsheet externo
 * Frecuencia: cada 6 horas (configurable en ensureAnunciantesAutSyncTrigger)
 */
function scheduledAnunciantesAutSync() {
  const res = {};
  try {
    res.anunciantes_aut_sync = syncAnunciantesAut();
    Logger.log('scheduledAnunciantesAutSync result: %s', JSON.stringify(res));
  } catch(e) {
    res.error = e && e.message ? e.message : String(e);
    Logger.log('scheduledAnunciantesAutSync error: %s', res.error);
  }
  try {
    SpreadsheetApp.getActive().toast(
      'Sync Anunciantes AUT: ' + JSON.stringify(res.anunciantes_aut_sync || res.error || 'ok'),
      'Anunciantes AUT Sync',
      6
    );
  } catch(e){}
  return res;
}

/**
 * Asegura que existe el trigger para sincronización periódica de anunciantes_aut
 * Frecuencia: cada 6 horas
 */
function ensureAnunciantesAutSyncTrigger() {
  const existing = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existing.length; i++) {
    const t = existing[i];
    if (t.getHandlerFunction() === 'scheduledAnunciantesAutSync' && t.getEventType() === ScriptApp.EventType.TIME_DRIVEN) {
      return; // Ya existe
    }
  }
  // Crear trigger cada 6 horas
  ScriptApp.newTrigger('scheduledAnunciantesAutSync').timeBased().everyHours(6).create();
}
