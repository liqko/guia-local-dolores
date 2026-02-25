/**
 * Eventos Sync - versión estabilizada
 *
 * Objetivos:
 * - eventos_free (Google Form) y eventos_vip (webapp/login y edición manual) son fuentes.
 * - unificada es vista materializada SOLO editable col "aprobado".
 * - sync rápido y robusto: onEdit VIP/FREE + time trigger respaldo.
 * - NO ejecuciones simultáneas: LockService.
 * - evitar "server error" reduciendo llamadas: escritura por fila en 1 operación.
 * - purga de eventos pasados: cada 6 horas (>= hoy 00:00 se mantiene).
 */

/* ---------- HOJAS PRINCIPALES ---------- */
const EVENTS_SHEET_NAME = 'unificada';
const VIP_SHEET_NAME = 'eventos_vip';
const FREE_SHEET_NAME = 'eventos_free';
const IMPORT_SHEET_NAME = 'anunciantes_import';

/* ---------- BASE DE DATOS ÚNICA (AUX) ---------- */
const AUX_PARTNER_SHEET = 'aux_partner';
const AUX_PLACES_SHEET = 'aux_lugares';
const AUX_LOCALIDAD_SHEET = 'aux_localidad';
const AUX_CATS_SHEET = 'aux_categorias';

/* ---------- Server secret ---------- */
const SERVER_SECRET = 'PzbqSEw9xNrwvWruJN7njiW905uwMiBS';

/* -------------------- AUTO-SYNC CONFIG -------------------- */
const AUTO_SYNC_THROTTLE_SECONDS = 20;      // más rápido que antes sin volverse loco
const AUTO_SYNC_TIME_MINUTES = 5;           // respaldo
const PURGE_EVERY_HOURS = 6;                // pedido: cada 6 horas
const KEEP_HOURLY_MAINTENANCE = false;      // desactivado: ya no hace falta el hourly extra

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
function _normStrict(s){ return String(s||'').trim().toLowerCase(); }
function SECRET_RESTRICTION() { return !!SERVER_SECRET; }

function _generateEventoId_(prefix){
  prefix = String(prefix || 'vip').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const now = Date.now();
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${now}-${rnd}`;
}

function _isIsoZ_(s){ return typeof s === 'string' && /Z$/.test(s); }
function normalizeTimeText_(v){
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return String(m[1]).padStart(2,'0') + ':' + m[2];
    if (s.indexOf('T') !== -1) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const useUtc = _isIsoZ_(s);
        const hh = String(useUtc ? d.getUTCHours() : d.getHours()).padStart(2,'0');
        const mm = String(useUtc ? d.getUTCMinutes() : d.getMinutes()).padStart(2,'0');
        return hh + ':' + mm;
      }
    }
    const n = Number(s.replace(',','.'));
    if (!isNaN(n) && isFinite(n) && n >= 0 && n < 1) {
      const totalMinutes = Math.round(n * 24 * 60);
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2,'0');
      const mm = String(totalMinutes % 60).padStart(2,'0');
      return hh + ':' + mm;
    }
    return s;
  }
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    const hh = String(v.getHours()).padStart(2,'0');
    const mm = String(v.getMinutes()).padStart(2,'0');
    return hh + ':' + mm;
  }
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

/* ---------- FECHA/PURGA ---------- */
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

/**
 * Purga (unificada): elimina eventos pasados (fecha_hasta/fecha_desde/fecha_iso < hoy 00:00).
 * Se ejecuta en trigger aparte cada 6 horas (más estable) y opcionalmente desde maintenance.
 */
function purgePastEventsFromUnificada(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) return { removed:0, checked:0, reason:'no sheet' };

  const headers = getHeaders(sh);
  const fd = headers.indexOf('fecha_desde');
  const fh = headers.indexOf('fecha_hasta');
  const fIso = headers.indexOf('fecha_iso');
  if (fd === -1 && fh === -1 && fIso === -1) return { removed:0, checked:0, reason:'no fecha column' };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (rows === 0) return { removed:0, checked:0 };

  const data = sh.getRange(2,1,rows,headers.length).getValues();

  let removed = 0, checked = 0;
  for (let r = data.length - 1; r >= 0; r--) {
    const rawFecha =
      (fh !== -1 ? data[r][fh] : '') ||
      (fd !== -1 ? data[r][fd] : '') ||
      (fIso !== -1 ? data[r][fIso] : '');
    if (!rawFecha) continue;

    const d = parseFechaAsDate(rawFecha);
    if (!d) continue;

    checked++;
    if (isDateBeforeToday(d)) { sh.deleteRow(r + 2); removed++; }
  }
  return { removed, checked };
}

/* ---------- Checkboxes ---------- */
function _normalizeBoolean_(v){
  const s = String(v||'').toLowerCase().trim();
  if (v === true) return true;
  if (v === false) return false;
  if (s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes' || s === 'x' || s === '✓') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return false;
}
function normalizePausadoText_(v){
  const b = _normalizeBoolean_(v);
  return b ? 'TRUE' : 'FALSE';
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

    const headers = getHeaders(shTarget);
    const idxAprobado = headers.indexOf('aprobado');
    if (idxAprobado === -1) return;

    const range = shTarget.getRange(startRow, idxAprobado + 1, rows, 1);
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

/* ---------- Partner (AUX) ---------- */
function getPartnerLists_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(AUX_PARTNER_SHEET);
  const partnersSet = new Set();
  const logosSet = new Set();
  if (sh && sh.getLastRow() >= 2) {
    const vals = sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for (const r of vals) {
      const partnerName = String(r[0]||'').trim();
      const logoUrl = String(r[1]||'').trim();
      if (partnerName) partnersSet.add(partnerName.trim().toLowerCase());
      if (logoUrl) logosSet.add(logoUrl.trim());
    }
  }
  return { partnersSet, logosSet };
}
function isPartnerHeader_(h){ return h === 'partner' || /^partner\d$/.test(h); }
function isLogoPartnerHeader_(h){ return h === 'logo_partner' || /^logo_partner\d$/.test(h); }

/**
 * Escritura rápida (1 llamada) de una fila en UNIFICADA.
 * - Para partner/logo_partner solo escribe si existe en aux_partner; si no, deja el valor anterior.
 * - Permite limpiar (escribir vacío) siempre.
 */
function safeWriteRow_(sheet, rowIndex, headers, rowOut){
  const { partnersSet, logosSet } = getPartnerLists_();

  const lastCol = Math.max(headers.length, sheet.getLastColumn());
  const current = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  const next = current.slice(0);

  for (let c=0;c<headers.length;c++){
    const h = headers[c] || '';
    const v = rowOut[c];

    const isStrict = isPartnerHeader_(h) || isLogoPartnerHeader_(h);
    if (isStrict){
      const s = String(v||'').trim();
      if (!s) { next[c] = ''; continue; } // limpiar permitido

      const set = isPartnerHeader_(h) ? partnersSet : logosSet;
      const key = isPartnerHeader_(h) ? s.trim().toLowerCase() : s.trim();
      if (!set.has(key)) continue; // inválido: no pisa
      next[c] = v;
      continue;
    }

    next[c] = v;
  }

  sheet.getRange(rowIndex, 1, 1, lastCol).setValues([next]);
}

/* ---------- Inserción en unificada ---------- */
function appendUnificadaRowSmart_(shTarget, targetHeaders, rowOut){
  const idxEvento = targetHeaders.indexOf('evento_id');
  const lastRow = shTarget.getLastRow();
  const start = 2;
  const n = Math.max(0, lastRow - 1);

  let writeRow;
  if (n === 0){
    shTarget.insertRowAfter(1);
    writeRow = 2;
  } else {
    const ids = shTarget.getRange(start, idxEvento + 1, n, 1).getValues();
    let lastWithId = 1; // header
    for (let i = ids.length - 1; i >= 0; i--){
      const v = String(ids[i][0] || '').trim();
      if (v){ lastWithId = start + i; break; }
    }
    shTarget.insertRowAfter(lastWithId);
    writeRow = lastWithId + 1;
  }

  safeWriteRow_(shTarget, writeRow, targetHeaders, rowOut);
  return writeRow;
}

/* ---------- FREE: asegurar evento_id si falta ---------- */
function ensureFreeEventoIdColumnAndFill_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FREE_SHEET_NAME);
  if (!sh) return { ok:false, reason:'no_free_sheet' };

  const headers = getHeaders(sh);
  let idxEvento = headers.indexOf('evento_id');

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

/* ---------- Enriquecimiento: VIP/FREE usando AUX ---------- */
function enrichSourceSheetFromLists(sheetName){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { enriched:0, checked:0, sheet: sheetName, reason:'no sheet' };

  const headers = getHeaders(sh);
  if (!headers.length) return { enriched:0, checked:0, sheet: sheetName };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { enriched:0, checked:0, sheet: sheetName };

  const isVip = (sheetName === VIP_SHEET_NAME);

  /* Lugares desde aux_lugares */
  const lugaresMap = {};
  const lugaresSh = ss.getSheetByName(AUX_PLACES_SHEET);
  if (lugaresSh && lugaresSh.getLastRow() >= 2) {
    const vals = lugaresSh.getRange(2,1,lugaresSh.getLastRow()-1,3).getValues();
    for (const r of vals) {
      const name = _norm(r[0] || '');
      if (!name) continue;
      lugaresMap[name] = { direccion: r[1] || '', llegar: r[2] || '' };
    }
  }

  /* Partner→Logo desde aux_partner */
  const partnerLogoMap = {};
  const partnerSh = ss.getSheetByName(AUX_PARTNER_SHEET);
  if (partnerSh && partnerSh.getLastRow() >= 2) {
    const vals = partnerSh.getRange(2,1,partnerSh.getLastRow()-1,2).getValues();
    for (const r of vals) {
      const name = _normStrict(r[0] || '');
      if (!name) continue;
      partnerLogoMap[name] = (r[1] || '').trim();
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

  let enriched = 0;
  const changesPerRow = Array.from({length: rows}, () => new Set());

  for (let i=0;i<data.length;i++){
    const row = data[i];

    // Advertiser info
    if (idxIdAnunciante !== -1) {
      const advId = String(row[idxIdAnunciante] || '').trim();
      if (advId) {
        const adv = getAdvertiserById(advId);
        if (adv) {
          if (idxOrganizador !== -1) {
            const cur = String(row[idxOrganizador] || '').trim();
            const advName = adv._name_from_B !== undefined ? adv._name_from_B : (adv.nombre || adv.nombre_comercio || adv.b || '');
            if (!cur && advName) { data[i][idxOrganizador] = advName; changesPerRow[i].add(idxOrganizador); }
          }
          if (idxLogoOrganizador !== -1) {
            const curL = String(row[idxLogoOrganizador] || '').trim();
            const advLogo = adv._logo_from_AY !== undefined ? adv._logo_from_AY : (adv.logo || adv.imagen || adv.logo_url || '');
            if (!curL && advLogo) { data[i][idxLogoOrganizador] = advLogo; changesPerRow[i].add(idxLogoOrganizador); }
          }
        }
      }
    }

    // Lugar -> direccion/llegar (VIP: overwrite; FREE: fill if empty)
    if (idxLugar !== -1) {
      const lugarVal = row[idxLugar];
      if (lugarVal) {
        const info = lugaresMap[_norm(lugarVal)];
        if (info) {
          if (idxDir !== -1 && (isVip || !row[idxDir] || String(row[idxDir]).trim() === '')) {
            data[i][idxDir] = info.direccion || '';
            changesPerRow[i].add(idxDir);
          }
          if (idxLlegar !== -1 && (isVip || !row[idxLlegar] || String(row[idxLlegar]).trim() === '')) {
            data[i][idxLlegar] = info.llegar || '';
            changesPerRow[i].add(idxLlegar);
          }
        }
      }
    }

    // Categoria -> logo_categoria
    if (idxCategoria !== -1 && idxLogoCategoria !== -1) {
      const catVal = String(row[idxCategoria] || '').trim();
      if (catVal && (!row[idxLogoCategoria] || String(row[idxLogoCategoria]).trim() === '')) {
        const url = findLogoForCategory(catVal);
        if (url) { data[i][idxLogoCategoria] = url; changesPerRow[i].add(idxLogoCategoria); }
      }
    }

    // Partner -> logo_partner
    for (let j=0;j<partnerIdx.length;j++){
      const pIdx = partnerIdx[j];
      const lpIdx = logoPartnerIdx[j];
      if (pIdx === -1 || lpIdx === -1) continue;
      const pVal = String(row[pIdx] || '').trim();
      if (pVal && (!row[lpIdx] || String(row[lpIdx]).trim() === '')) {
        const key = _normStrict(pVal);
        const logo = partnerLogoMap[key] || '';
        if (logo) { data[i][lpIdx] = logo; changesPerRow[i].add(lpIdx); }
      }
    }

    if (changesPerRow[i].size > 0) enriched++;
  }

  // escritura por celda solo de las celdas que cambian
  for (let i=0;i<rows;i++){
    if (changesPerRow[i].size === 0) continue;
    const rowIndex = 2 + i;
    changesPerRow[i].forEach(idx => {
      sh.getRange(rowIndex, idx + 1).setValue(data[i][idx]);
    });
  }

  return { enriched, checked: rows, sheet: sheetName };
}

/* ---------- Validaciones: VIP/FREE contra AUX (sin dropdown; edición excepcional permitida) ---------- */
function fixPartnerLogoValidations(sheetName, options){
  options = options || {};
  const showDropdown = options.showDropdown === true ? true : false; // default: false
  const allowInvalid = options.allowInvalid === true ? true : false; // default: false

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { ok:false, reason:'sheet not found' };
  const headers = getHeaders(sh);

  const partnerSh = ss.getSheetByName(AUX_PARTNER_SHEET);
  if (!partnerSh || partnerSh.getLastRow() < 2) return { ok:false, reason:'aux_partner empty' };

  const partnersRange = partnerSh.getRange(2, 1, partnerSh.getLastRow() - 1, 1);
  const logosRange    = partnerSh.getRange(2, 2, partnerSh.getLastRow() - 1, 1);

  function setStrict(idx, range){
    if (idx !== -1) {
      const startRow = 2;
      const maxRows = Math.max(0, sh.getMaxRows() - 1);
      const target = sh.getRange(startRow, idx + 1, maxRows, 1);
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(range, showDropdown)
        .setAllowInvalid(allowInvalid)
        .build();
      target.setDataValidation(rule);
    }
  }

  setStrict(headers.indexOf('partner'), partnersRange);
  setStrict(headers.indexOf('partner2'), partnersRange);
  setStrict(headers.indexOf('partner3'), partnersRange);
  setStrict(headers.indexOf('partner4'), partnersRange);
  setStrict(headers.indexOf('partner5'), partnersRange);
  setStrict(headers.indexOf('partner6'), partnersRange);

  setStrict(headers.indexOf('logo_partner'), logosRange);
  setStrict(headers.indexOf('logo_partner2'), logosRange);
  setStrict(headers.indexOf('logo_partner3'), logosRange);
  setStrict(headers.indexOf('logo_partner4'), logosRange);
  setStrict(headers.indexOf('logo_partner5'), logosRange);
  setStrict(headers.indexOf('logo_partner6'), logosRange);

  return { ok:true };
}

/* ---------- Eliminar validaciones en UNIFICADA (quitar desplegables/errores) ---------- */
function clearUnificadaValidations(){
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(EVENTS_SHEET_NAME);
    if (!sh) return { ok:false, reason:'unificada not found' };

    const headers = getHeaders(sh);
    const lastCol = Math.max(1, sh.getLastColumn());
    const maxRows = Math.max(0, sh.getMaxRows() - 1);
    const startRow = 2;

    const idxAprobado = headers.indexOf('aprobado');
    const idxPausado  = headers.indexOf('pausado');

    for (let c=1; c<=lastCol; c++){
      const isKeep = ((c-1) === idxAprobado) || ((c-1) === idxPausado);
      if (isKeep) continue;
      const rng = sh.getRange(startRow, c, maxRows, 1);
      try { rng.setDataValidation(null); } catch(e){}
    }

    if (idxAprobado !== -1) {
      const rngA = sh.getRange(startRow, idxAprobado+1, maxRows, 1);
      try { rngA.insertCheckboxes(); } catch(e){}
    }
    if (idxPausado !== -1) {
      const rngP = sh.getRange(startRow, idxPausado+1, maxRows, 1);
      try { rngP.insertCheckboxes(); } catch(e){}
    }

    return { ok:true };
  } catch(e){
    return { ok:false, error:e && e.message ? e.message : String(e) };
  }
}

/* ---------- Categorías (AUX_CATS) ---------- */
function findLogoForCategory(title) {
  title = String(title || '').trim();
  if (!title) return '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const catSh = ss.getSheetByName(AUX_CATS_SHEET);
  if (!catSh) return '';
  const last = Math.max(1, catSh.getLastRow());
  if (last < 2) return '';
  const vals = catSh.getRange(2,1,last-1,Math.max(1,catSh.getLastColumn())).getValues();
  for (let i=0;i<vals.length;i++){
    if (String(vals[i][0] || '').trim() === title) return String(vals[i][1] || '').trim();
  }
  return '';
}

/* ---------- Advertiser (import) ---------- */
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

/* ---------- Audit ---------- */
function writeAuditEventRow(sheet, row, action, advertiserId) {
  try {
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const auditText = action + ' at ' + now + ' by ' + advertiserId;
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
    cell.setValue(existing ? (existing + ' | ' + auditText) : auditText);
  } catch(e){}
}

/* ======================================================================
   CRUD VIP (webapp/login)
   ====================================================================== */

function getVipEvents(advertiserId){
  advertiserId = String(advertiserId || '').trim();
  if (!advertiserId) return { events: [], count: 0 };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VIP_SHEET_NAME);
  if (!sh) return { events: [], count: 0 };
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

  const vipSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VIP_SHEET_NAME);
  if (!vipSh) return { error: 'vip sheet missing' };
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
    'lugar','direccion','llegar','fecha_desde','fecha_hasta','hora','hora2','descripcion','instagram',
    'img1','img2','img3','entradas',
    'partner','logo_partner','partner2','logo_partner2','partner3','logo_partner3',
    'partner4','logo_partner4','partner5','logo_partner5','partner6','logo_partner6'
  ];

  const fecha_desde = payload.fecha_desde || payload.fecha || '';
  const fecha_hasta = payload.fecha_hasta || '';

  keys.forEach(k => {
    let val = (k === 'fecha_desde') ? fecha_desde : (k === 'fecha_hasta' ? fecha_hasta : (payload[k] || ''));
    if (k === 'hora' || k === 'hora2') val = normalizeTimeText_(val);
    if (k === 'fecha_desde' || k === 'fecha_hasta') val = normalizeDateText_(val);
    setFieldLocal(k, val);
  });

  setFieldLocal('pausado', 'FALSE');
  setFieldLocal('audit', 'created_vip ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));

  vipSh.appendRow(row);
  const newRow = vipSh.getLastRow();

  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { requestQuickSync_('create_vip_event'); } catch(e){}

  return { success:true, created:true, evento_id: newEventoId, row: newRow };
}

function updateVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const eventoId = String(payload.evento_id || '').trim();

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!eventoId) return { error: 'evento_id required' };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VIP_SHEET_NAME);
  if (!sh) return { error: 'vip sheet missing' };
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
    'lugar','direccion','llegar','fecha_desde','fecha_hasta','hora','hora2','descripcion','instagram',
    'img1','img2','img3','entradas',
    'partner','logo_partner','partner2','logo_partner2','partner3','logo_partner3',
    'partner4','logo_partner4','partner5','logo_partner5','partner6','logo_partner6'
  ]);

  for (const k in payload){
    const key = String(k||'').toLowerCase().trim();
    if (key === 'fecha') {
      const idxFd = headers.indexOf('fecha_desde');
      if (idxFd !== -1) sh.getRange(foundRow, idxFd+1).setValue(normalizeDateText_(payload[k]));
      continue;
    }
    if (!allowed.has(key)) continue;
    const idx = headers.indexOf(key);
    if (idx === -1) continue;

    let val = payload[k];
    if (key === 'hora' || key === 'hora2') val = normalizeTimeText_(val);
    if (key === 'fecha_desde' || key === 'fecha_hasta') val = normalizeDateText_(val);

    sh.getRange(foundRow, idx+1).setValue(val);
  }

  writeAuditEventRow(sh, foundRow, 'update_vip', advertiserId);

  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { requestQuickSync_('update_vip_event'); } catch(e){}

  return { success:true, updated:true, evento_id: eventoId, row: foundRow };
}

function duplicateVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const srcEventoId = String(payload.evento_id || payload.source_evento_id || '').trim();

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!srcEventoId) return { error: 'evento_id required' };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VIP_SHEET_NAME);
  if (!sh) return { error: 'vip sheet missing' };
  const headers = getHeaders(sh);

  const idxEvento = headers.indexOf('evento_id');
  const idxAdv = headers.indexOf('id_anunciante');
  if (idxEvento === -1) return { error: 'VIP missing evento_id column' };

  const rows = Math.max(0, sh.getLastRow() - 1);
  if (!rows) return { error: 'no vip events' };

  const data = sh.getRange(2,1,rows,headers.length).getValues();

  let srcRowArr = null;
  for (let r=0;r<data.length;r++){
    const eid = String(data[r][idxEvento] || '').trim();
    if (eid !== srcEventoId) continue;

    const adv = idxAdv !== -1 ? String(data[r][idxAdv] || '').trim() : '';
    if (adv !== advertiserId) return { error: 'event belongs to another advertiser' };

    srcRowArr = data[r];
    break;
  }
  if (!srcRowArr) return { error: 'event not found' };

  const newRow = srcRowArr.slice(0);

  const newEventoId = _generateEventoId_('vip');
  newRow[idxEvento] = newEventoId;

  const idxPausado = headers.indexOf('pausado');
  if (idxPausado !== -1) newRow[idxPausado] = 'FALSE';

  const idxAudit = headers.indexOf('audit');
  if (idxAudit !== -1) {
    newRow[idxAudit] = 'duplicated_vip ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  // opcional overrides
  const allowed = new Set([
    'organizador','logo_organizador','categoria','logo_categoria','nombre_evento','localidad',
    'lugar','direccion','llegar','fecha_desde','fecha_hasta','hora','hora2','descripcion','instagram',
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
    if (key === 'fecha_desde' || key === 'fecha_hasta') val = normalizeDateText_(val);
    newRow[idx] = val;
  }

  sh.appendRow(newRow);
  const newSheetRow = sh.getLastRow();

  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { requestQuickSync_('duplicate_vip_event'); } catch(e){}

  return { success:true, duplicated:true, from_evento_id: srcEventoId, evento_id: newEventoId, row: newSheetRow };
}

function deleteVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const eventoId = String(payload.evento_id || '').trim();

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!eventoId) return { error: 'evento_id required' };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VIP_SHEET_NAME);
  if (!sh) return { error: 'vip sheet missing' };
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
    try { requestQuickSync_('delete_vip_event'); } catch(e){}
    return { success:true, deleted:true, evento_id: eventoId };
  }

  return { error: 'event not found' };
}

function pauseVipEvent(advertiserId, payload){
  advertiserId = String(advertiserId || '').trim();
  payload = payload && typeof payload === 'object' ? payload : {};
  const eventoId = String(payload.evento_id || '').trim();
  const pauseValue = payload.pause === true || payload.pause === 'true' || payload.pause === 'TRUE';

  if (!advertiserId) return { error: 'advertiserId required' };
  if (!eventoId) return { error: 'evento_id required' };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VIP_SHEET_NAME);
  if (!sh) return { error: 'vip sheet missing' };
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

    if (idxPausado !== -1) sh.getRange(r + 2, idxPausado + 1).setValue(pauseValue ? 'TRUE' : 'FALSE');
    writeAuditEventRow(sh, r + 2, pauseValue ? 'pause_vip' : 'resume_vip', advertiserId);

    try { requestQuickSync_('pause_vip_event'); } catch(e){}
    return { success:true, paused: pauseValue, evento_id: eventoId };
  }

  return { error: 'event not found' };
}

/* ---------- EVENTS WS (lectura para web) ---------- */
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
      const okAprobado = (apro === 'true' || apro === '1' || apro === 'si' || apro === 'yes');
      const isPausado = (paus === 'true' || paus === '1' || paus === 'si' || paus === 'yes');
      if (okAprobado && !isPausado) out.push(obj);
    }
  }
  return { events: out };
}

/* ---------- Router + WebApp ---------- */
function handleEventAction(action, advertiserId, payload, params) {
  const act = String(action||'').trim().replace(/\s+/g,'').replace(/-+/g,'_').toLowerCase();
  if (act === 'getevents' || act === 'get_events' || act === 'get-events') {
    const adv = advertiserId || (params && (params.advertiserId || params.id || params.advertiserID)) || '';
    return getEventsForAdvertiserWS(adv);
  }
  return { error: 'unknown event action: ' + action };
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const rawAction = String(params.action || params.accion || '').trim();
    let action = rawAction.replace(/\s+/g,'').replace(/-+/g,'_').toLowerCase();
    const secret = String(params.serverSecret || '');

    if (!action) action = 'getevents';
    if (SECRET_RESTRICTION() && action !== 'getevents' && secret !== SERVER_SECRET) return jsonResponse({ error: 'unauthorized' }, 401);

    if (action === 'getevents' || action === 'get_events' || action === 'get-events') {
      const advertiserId = params.advertiserId || params.advertiserID || params.id || '';
      return jsonResponse(Object.assign(getEventsForAdvertiserWS(advertiserId), { receivedAction: rawAction || '(implicit getEvents)' }));
    }

    return jsonResponse({ error: 'unknown action', receivedParams: params }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    try { ensureAutoSyncTriggers(); } catch(_){}

    let body = {};
    try { body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; }
    catch(parseErr) {
      const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
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
    if (action === 'duplicatevipevent' || action === 'duplicate_vip_event' || action === 'duplicate') return jsonResponse(duplicateVipEvent(advertiserId, body.payload || body));
    if (action === 'deletevipevent' || action === 'delete_vip_event') return jsonResponse(deleteVipEvent(advertiserId, body.payload || body));
    if (action === 'pausevipevent' || action === 'pause_vip_event') return jsonResponse(pauseVipEvent(advertiserId, body.payload || body));

    if (['getevents','get_events','get-events'].indexOf(action) !== -1) {
      return jsonResponse(handleEventAction(action, advertiserId, body.payload || body, params));
    }

    return jsonResponse({ error: 'unknown action', receivedAction: detectedRaw }, 400);
  } catch(err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/* ---------- Sync unificada (core) ---------- */
function syncUnificadaFromSources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Validaciones VIP/FREE contra AUX (sin dropdown, edición excepcional permitida)
  try { fixPartnerLogoValidations(VIP_SHEET_NAME, { showDropdown:false, allowInvalid:true }); } catch(e){}
  try { fixPartnerLogoValidations(FREE_SHEET_NAME, { showDropdown:false, allowInvalid:true }); } catch(e){}

  ensureFreeEventoIdColumnAndFill_();

  // Enriquecer (VIP pisa direccion/llegar; FREE fill-only)
  try { enrichSourceSheetFromLists(VIP_SHEET_NAME); } catch(e){}
  try { enrichSourceSheetFromLists(FREE_SHEET_NAME); } catch(e){}

  const shTarget = ss.getSheetByName(EVENTS_SHEET_NAME);
  if (!shTarget) throw new Error("Hoja destino 'unificada' no encontrada.");

  const shVip = ss.getSheetByName(VIP_SHEET_NAME);
  const shFree = ss.getSheetByName(FREE_SHEET_NAME);

  const targetHeaders = getHeaders(shTarget);
  const idxAprobadoTarget = targetHeaders.indexOf('aprobado');
  const idxNivelTarget = targetHeaders.indexOf('nivel');
  const idxEventoTarget = targetHeaders.indexOf('evento_id');
  const idxFechaDesdeTarget = targetHeaders.indexOf('fecha_desde');
  const idxFechaHastaTarget = targetHeaders.indexOf('fecha_hasta');
  const idxHoraTarget = targetHeaders.indexOf('hora');
  const idxHora2Target = targetHeaders.indexOf('hora2');
  const idxPausadoTarget = targetHeaders.indexOf('pausado');

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
    const id = getIdFromRawRow(freeFull.rawHeaders, rowArr) || ('free-noid-' + (r+1));
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

    // MAPEO POR HEADERS (no offset)
    const srcIndex = {};
    for (let i=0;i<srcHeaders.length;i++){
      const h = String(srcHeaders[i]||'').toLowerCase().trim();
      if (h && srcIndex[h] === undefined) srcIndex[h] = i;
    }
    for (let t=0; t<targetHeaders.length; t++){
      if (t === idxNivelTarget || t === idxEventoTarget || t === idxAprobadoTarget) continue;

      const th = String(targetHeaders[t]||'').toLowerCase().trim();
      const sIdx = srcIndex[th];
      if (sIdx === undefined) continue;

      rowOut[t] = (sIdx < srcRow.length) ? (srcRow[sIdx] === undefined ? '' : srcRow[sIdx]) : '';
    }

    // pausado normalize
    if (idxPausadoTarget !== -1) {
      const idxPausadoSrc = srcHeaders.indexOf('pausado');
      if (idxPausadoSrc !== -1) rowOut[idxPausadoTarget] = normalizePausadoText_(srcRow[idxPausadoSrc]);
      else rowOut[idxPausadoTarget] = normalizePausadoText_(rowOut[idxPausadoTarget]);
    }

    // normalizaciones
    if (idxFechaDesdeTarget !== -1) rowOut[idxFechaDesdeTarget] = normalizeDateText_(rowOut[idxFechaDesdeTarget]);
    if (idxFechaHastaTarget !== -1) rowOut[idxFechaHastaTarget] = normalizeDateText_(rowOut[idxFechaHastaTarget]);
    if (idxHoraTarget !== -1) rowOut[idxHoraTarget] = normalizeTimeText_(rowOut[idxHoraTarget]);
    if (idxHora2Target !== -1) rowOut[idxHora2Target] = normalizeTimeText_(rowOut[idxHora2Target]);

    const existingRowNum = idToRow[String(item.id)];
    if (existingRowNum) {
      safeWriteRow_(shTarget, existingRowNum, targetHeaders, rowOut);
      updated++;
    } else {
      const newRow = appendUnificadaRowSmart_(shTarget, targetHeaders, rowOut);
      appended++;
      idToRow[String(item.id)] = newRow;
    }
  }

  // borrar de unificada los que ya no existen en vip/free
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
  clearUnificadaValidations();

  return {
    updated_existing_rows: updated,
    appended_new_rows: appended,
    deleted_from_unificada_missing_in_sources: deleted
  };
}

/* ---------- Protección unificada ---------- */
function protectUnificadaSheet(){
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(EVENTS_SHEET_NAME);
    if (!sh) return { ok:false, reason:'unificada not found' };

    const old = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    old.forEach(p => { try { p.remove(); } catch(e){} });

    const protection = sh.protect();
    protection.setDescription('Unificada: sólo columna "aprobado" editable');
    protection.setWarningOnly(false);
    try { protection.removeEditors(protection.getEditors()); } catch(e){}

    const headers = getHeaders(sh);
    const idxAprobado = headers.indexOf('aprobado');
    if (idxAprobado !== -1) {
      const rng = sh.getRange(2, idxAprobado + 1, Math.max(0, sh.getMaxRows() - 1), 1);
      protection.setUnprotectedRanges([rng]);
    }

    clearUnificadaValidations();
    return { ok:true };
  } catch(e){
    return { ok:false, error: e && e.message ? e.message : String(e) };
  }
}

/* ---------- Sync wrapper: throttle + lock ---------- */
function requestQuickSync_(reason){
  return _throttledSync_(reason || 'quick');
}

function _throttledSync_(reason){
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('LAST_SYNC_TS') || '0');
  const now = Date.now();
  if (now - last < AUTO_SYNC_THROTTLE_SECONDS * 1000) {
    return { skipped:true, reason:'throttled', last_sync_ts:last, now:now };
  }

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(8000)) return { skipped:true, reason:'locked' };

  try {
    props.setProperty('LAST_SYNC_TS', String(now));
    props.setProperty('LAST_SYNC_REASON', String(reason||''));
    return syncUnificadaFromSources();
  } catch (e) {
    props.setProperty('LAST_SYNC_TS', String(0));
    throw e;
  } finally {
    try { lock.releaseLock(); } catch(_){}
  }
}

/* ---------- Purga wrapper (cada 6 horas) ---------- */
function scheduledPurgeOldEvents(){
  // lock también para que no se pise con sync
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(8000)) return { skipped:true, reason:'locked' };
  try {
    return purgePastEventsFromUnificada();
  } finally {
    try { lock.releaseLock(); } catch(_){}
  }
}

/* ---------- Triggers (instalación automática) ---------- */
function ensureAutoSyncTriggers(){
  try { ensureTimedSyncTrigger(); } catch(e){}
  try { ensurePurgeTriggerEvery6Hours_(); } catch(e){}
}

function ensureTimedSyncTrigger(){
  const existing = ScriptApp.getProjectTriggers();
  for (let i=0;i<existing.length;i++){
    const t = existing[i];
    if (t.getHandlerFunction() === 'scheduledQuickSync' && t.getEventType() === ScriptApp.EventType.TIME_DRIVEN) return;
  }
  ScriptApp.newTrigger('scheduledQuickSync').timeBased().everyMinutes(AUTO_SYNC_TIME_MINUTES).create();
}

function ensurePurgeTriggerEvery6Hours_(){
  const existing = ScriptApp.getProjectTriggers();
  for (let i=0;i<existing.length;i++){
    const t = existing[i];
    if (t.getHandlerFunction() === 'scheduledPurgeOldEvents' && t.getEventType() === ScriptApp.EventType.TIME_DRIVEN) return;
  }
  ScriptApp.newTrigger('scheduledPurgeOldEvents').timeBased().everyHours(PURGE_EVERY_HOURS).create();
}

function scheduledQuickSync(){ return _throttledSync_('time_based_quick_sync'); }

/**
 * Botón nuclear: borra TODOS los triggers del proyecto y crea solo los recomendados.
 * Esto evita que queden triggers viejos (onVipEditSync/onFreeEditSync/etc) rompiendo todo.
 */
function resetAllTriggersToRecommended(){
  const triggers = ScriptApp.getProjectTriggers();
  for (let i=0;i<triggers.length;i++){
    try { ScriptApp.deleteTrigger(triggers[i]); } catch(e){}
  }
  ensureAutoSyncTriggers();
  return { ok:true, deleted: triggers.length, created: 'scheduledQuickSync + scheduledPurgeOldEvents (and built-in onEdit/onOpen)' };
}

/* ---------- onOpen + onEdit ---------- */
function onOpen(){
  try { ensureAutoSyncTriggers(); } catch(e){}
  try { protectUnificadaSheet(); } catch(e){}
}

function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet) return;
  const sheetName = sheet.getName();

  // UNIFICADA: solo col aprobado
  if (sheetName === EVENTS_SHEET_NAME) {
    const headers = getHeaders(sheet);
    const idxAprobado = headers.indexOf('aprobado');
    const editedCol = range.getColumn();
    if (idxAprobado !== -1 && editedCol !== (idxAprobado + 1)) {
      try { SpreadsheetApp.getActive().toast('Unificada: edición no permitida (solo "aprobado"). Restaurando...', 'UNIFICADA', 4); } catch(_){}
      try { _throttledSync_('unificada_illegal_edit_restore'); } catch(_){}
    }
    return;
  }

  // VIP/FREE: sync rápido, pero con throttle+lock
  if (sheetName === VIP_SHEET_NAME || sheetName === FREE_SHEET_NAME) {
    try { _throttledSync_(sheetName + '_edit'); }
    catch(err) {
      try { SpreadsheetApp.getActive().toast('Autosync ERROR: ' + (err && err.message ? err.message : err), 'SYNC', 6); } catch(_){}
    }
  }
}
