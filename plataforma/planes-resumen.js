/* Resumen único para Gran Hermano y página pública. Sin consultas ni escrituras. */
(function(root){
'use strict';
const definitions=[
 ['logo_habilitado','Logo','flag'],
 ['descripcion_habilitada','Descripción','flag'],
 ['actividad_habilitada','Actividad / aclaración','flag'],
 ['servicios_iconos_habilitados','Servicios y prestaciones','flag'],
 ['horarios_habilitados','Horarios','flag'],
 ['direccion_habilitada','Dirección','flag'],
 ['mapa_habilitado','Ubicación en mapa','flag'],
 ['telefono_habilitado','Teléfono','flag'],
 ['whatsapp_habilitado','WhatsApp','flag'],
 ['mail_habilitado','Correo electrónico','flag'],
 ['web_habilitada','Acceso web','flag'],
 ['favoritos_habilitados','Favoritos','flag'],
 ['compartir_habilitado','Compartir','flag'],
 ['verificado_habilitado','Insignia Verificado','flag'],
 ['gold_habilitado','Insignia Gold','flag'],
 ['insignias_actividades_habilitadas','Insignias de actividades','flag'],
 ['insignias_nodos_habilitadas','Insignias de nodos','flag'],
 ['adicionales_habilitados','Información adicional','flag'],
 ['tags_habilitados','Etiquetas','flag'],
 ['imagenes_max','Imágenes por sede','num'],
 ['redes_visibles_max','Redes sociales visibles','num'],
 ['redes_enlaces_max','Redes con enlace','num'],
 ['sedes_publicadas_max','Sedes publicadas','num'],
 ['contactos_visibles_max','Medios de contacto','num']
];
function number(row){const n=Number(row?.numero??row?.nivel_id??row?.id);return Number.isSafeInteger(n)?n:null;}
function flag(v){if(v===true||v===1)return true;if(v===false||v===0)return false;if(v===null||v===undefined||v==='')return null;return ['true','1','si','sí','x','activo','activa'].includes(String(v).trim().toLowerCase());}
function active(row){return flag(row?.activo??row?.activa)!==false&&row?.eliminado!==true;}
function summary(row){
 return definitions.map(([key,label,kind])=>{let value=row[key];if(kind==='flag'){value=flag(value);if(value===null)return null;return {key,label,value:value?'Sí':'No',enabled:value};}
 if(value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value)))return null;
 const n=Number(value);return {key,label,value:String(n),enabled:n>0};
 }).filter(Boolean);
}
function name(row){return String(row?.titulo||row?.nombre||row?.label||'').trim();}
function price(row){const v=row?.precio_publico_ars;return v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;}
function publishPrice(row){return flag(row?.precio_visible_publico)===true&&price(row)!==null;}
root.GLD_PLANES_RESUMEN={number,flag,active,summary,name,price,publishPrice,definitions};
})(globalThis);
