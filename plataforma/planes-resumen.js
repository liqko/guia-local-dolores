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

/* Presentación comercial: las prestaciones se agrupan sin alterar los permisos originales.
   Actividades clave son clasificaciones de la sede; la insignia configurada es de ACCIONES. */
const publicDescriptions={
 logo_habilitado:'Identidad visual del anunciante.',
 descripcion_habilitada:'Texto de presentación del anunciante.',
 actividad_habilitada:'Actividad principal o aclaración del nombre para reconocer qué ofrece.',
 servicios_iconos_habilitados:'Íconos de servicios y prestaciones disponibles en cada sede (por ejemplo, Wi-Fi, delivery o reservas).',
 horarios_habilitados:'Horarios de atención correspondientes a cada sede.',
 direccion_habilitada:'Domicilio físico de cada sede.',
 mapa_habilitado:'Ubicación geográfica de cada sede, para encontrarla en el mapa.',
 telefono_habilitado:'Teléfono de contacto correspondiente a cada sede.',
 whatsapp_habilitado:'WhatsApp de contacto correspondiente a cada sede.',
 mail_habilitado:'Correo electrónico correspondiente a cada sede.',
 web_habilitada:'Acceso dentro de Guía Local: micrositio autogestionado (en desarrollo), micrositio a medida (en desarrollo) o página web embebida en la plataforma. No implica habilitar un enlace directo a una web externa.',
 favoritos_habilitados:'Permite guardar la ficha entre los favoritos.',
 compartir_habilitado:'Permite compartir la ficha.',
 verificado_habilitado:'Insignia que identifica una ficha cuya verificación fue otorgada por Guía Local; no certifica todos sus productos o servicios.',
 gold_habilitado:'Distintivo Gold del nivel premium (nivel 6).',
 insignias_actividades_habilitadas:'Insignias de acciones: identifican acciones o características específicas asociadas a la sede, según las opciones de la plataforma.',
 insignias_nodos_habilitadas:'Insignias de nodos: identifican espacios, complejos o agrupamientos territoriales a los que pertenece una sede.',
 adicionales_habilitados:'Información complementaria habilitada en la ficha.',
 tags_habilitados:'Etiquetas o palabras clave que ayudan a encontrar la ficha en búsquedas relacionadas.',
 imagenes_max:'Imágenes visibles de cada sede.',
 redes_visibles_max:'Perfiles sociales visibles de cada sede.',
 redes_enlaces_max:'Perfiles sociales de cada sede que pueden abrirse mediante enlace.',
 sedes_publicadas_max:'Cantidad de locales, sucursales, oficinas u otros puntos de atención que pueden mostrarse.',
 contactos_visibles_max:'Cantidad de medios de contacto que pueden mostrarse en cada sede.',
 contacto_modo:'Regla para determinar qué datos de contacto se muestran en cada sede.'
};
const publicLabels={
 actividad_habilitada:'Actividad principal',
 servicios_iconos_habilitados:'Íconos de servicios por sede',
 horarios_habilitados:'Horarios por sede',
 direccion_habilitada:'Dirección por sede',
 mapa_habilitado:'Mapa por sede',
 telefono_habilitado:'Teléfono por sede',
 whatsapp_habilitado:'WhatsApp por sede',
 mail_habilitado:'Correo electrónico por sede',
 web_habilitada:'Acceso web dentro de Guía Local por sede',
 insignias_actividades_habilitadas:'Insignias de acciones',
 insignias_nodos_habilitadas:'Insignias de nodos',
 imagenes_max:'Imágenes por sede',
 redes_visibles_max:'Redes visibles por sede',
 redes_enlaces_max:'Redes enlazadas por sede',
 contactos_visibles_max:'Contactos por sede'
};
const groupKeys={
 general:['logo_habilitado','descripcion_habilitada','actividad_habilitada','adicionales_habilitados','tags_habilitados','favoritos_habilitados','compartir_habilitado'],
 sede:['sedes_publicadas_max','servicios_iconos_habilitados','horarios_habilitados','direccion_habilitada','mapa_habilitado','telefono_habilitado','whatsapp_habilitado','mail_habilitado','web_habilitada','imagenes_max','redes_visibles_max','redes_enlaces_max','contactos_visibles_max','contacto_modo'],
 insignias:['verificado_habilitado','gold_habilitado','insignias_actividades_habilitadas','insignias_nodos_habilitadas']
};
function positiveInt(v){return v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;}
function sections(row,general={}){
 const all=summary(row).filter(x=>x.enabled);
 const byKey=new Map(all.map(x=>[x.key,x]));
 // 'contacto_modo' y el máximo de descripción provienen de campos ya existentes.
 const mode=row?.contacto_modo;
 if(mode==='direccion_o_alternativa'||mode==='libre')
  byKey.set('contacto_modo',{key:'contacto_modo',value:mode==='libre'?'Medios permitidos':'Dirección, o un contacto alternativo',enabled:true});
 const output=[];
 for(const [group,keys] of Object.entries(groupKeys)){
  const items=[];
  for(const key of keys){
   const f=byKey.get(key);if(!f)continue;
   if(key==='gold_habilitado'&&number(row)!==6)continue; // Gold solo se anuncia para el premium.
   let value=f.value==='Sí'?'':f.value;
   let description=publicDescriptions[key]||'';
   if(key==='descripcion_habilitada'){
    const perGroup=positiveInt(general?.['carga_'+(number(row)<=2?'institucional':'comercial')+'_descripcion_max']);
    const limit=perGroup??positiveInt(general?.carga_descripcion_max);
    if(limit!==null)description+=' Hasta '+limit+' caracteres.';
   }
   if(key==='actividad_habilitada'){
    const max=positiveInt(general?.['carga_'+(number(row)<=2?'institucional':'comercial')+'_actividad_max']??general?.carga_actividad_max);
    if(max!==null)description+=' Hasta '+max+' caracteres.';
   }
   if(key==='contactos_visibles_max'&&value==='0')value='Sin límite';
   if(key==='sedes_publicadas_max'&&value==='0')value='Sin límite configurado';
   items.push({key,label:publicLabels[key]||f.label,value,description});
  }
  if(items.length)output.push({key:group,title:group==='general'?'Información del anunciante':group==='sede'?'Información de cada sede':'Distintivos e insignias',items});
 }
 return output;
}
const glossary=[
 {term:'Sede',meaning:'Cada local, sucursal, oficina o lugar de atención de un anunciante. Un mismo anunciante puede tener varias sedes con domicilios y contactos diferentes.'},
 {term:'Nodo',meaning:'Espacio, complejo o agrupamiento territorial al que puede pertenecer una sede, como un parque o centro comercial.'},
 {term:'Actividades clave',meaning:'Clasificaciones que describen las actividades principales realizadas en una sede y ayudan a relacionarla con las búsquedas de la guía.'},
 {term:'Acciones',meaning:'Características o acciones específicas identificadas mediante opciones de la plataforma. Cuando el nivel lo permite, pueden mostrarse sus insignias.'},
 {term:'Etiquetas (tags)',meaning:'Palabras clave asociadas al anunciante que facilitan encontrarlo por búsquedas relacionadas; no cambian la actividad ni la categoría.'},
 {term:'Verificado',meaning:'Distintivo que señala que Guía Local realizó la verificación prevista para una ficha; no equivale a una garantía sobre cada servicio.'}
];
function name(row){return String(row?.titulo||row?.nombre||row?.label||'').trim();}
function price(row){const v=row?.precio_publico_ars;return v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;}
function publishPrice(row){return flag(row?.precio_visible_publico)===true&&price(row)!==null;}
root.GLD_PLANES_RESUMEN={number,flag,active,summary,sections,glossary,name,price,publishPrice,definitions};
})(globalThis);
