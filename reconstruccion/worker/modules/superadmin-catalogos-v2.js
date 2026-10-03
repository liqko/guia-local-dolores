/**
 * CATÁLOGOS DE GRAN HERMANO
 * Lectura normal: paquete admin KV.
 * Guardado: 1 PATCH Firestore + parche de KV admin + parche del catálogo activo del módulo.
 */
import {catalogKeys} from "../core/catalogs.js";

const ADMIN_KEY="admin:catalogs:v2";
const text=v=>String(v??"").trim();

const defs={
  segmentos:{collection:"segmentos",idField:"segmento_id",moduleKey:catalogKeys.commerce,moduleField:"segmentos"},
  niveles_anunciante:{collection:"niveles_anunciante",idField:"nivel_id",moduleKey:catalogKeys.commerce,moduleField:"niveles_anunciante"},
  funcionalidades:{collection:"funcionalidades",idField:"funcionalidad_id",moduleKey:catalogKeys.commerce,moduleField:"funcionalidades"},
  categorias:{collection:"categorias",idField:"categoria_id",moduleKey:catalogKeys.commerce,moduleField:"categorias"},
  actividades_clave:{collection:"actividades_clave",idField:"actividad_id",moduleKey:catalogKeys.commerce,moduleField:"actividades_clave"},
  acciones:{collection:"acciones",idField:"accion_id",moduleKey:catalogKeys.commerce,moduleField:"acciones"},
  nodos:{collection:"nodos",idField:"nodo_id",moduleKey:catalogKeys.commerce,moduleField:"nodos"},
  eventos_categorias:{collection:"eventos_categorias",idField:"categoria_id",moduleKey:catalogKeys.eventos,moduleField:"categorias"},
  actividades_categorias:{collection:"actividades_categorias",idField:"categoria_id",moduleKey:catalogKeys.actividades,moduleField:"categorias"},
  moderacion_18:{collection:"eventos_moderacion_palabras",idField:"regla_id",moduleKey:"",moduleField:""}
};

function active(x){
  if(x.activo===undefined&&x.activa===undefined)return true;
  const v=x.activo??x.activa;
  if(v===true||v===1)return true;
  return ["true","1","si","sí","x","activo","activa"].includes(text(v).toLowerCase());
}
function upsert(rows,idField,item){
  const id=text(item[idField]||item.id);
  const out=(rows||[]).filter(x=>text(x[idField]||x.id)!==id);
  out.push(item);
  return out;
}
function sortRows(rows){
  return [...(rows||[])].sort((a,b)=>{
    const ao=Number(a.orden??a.prioridad??a.numero??999999);
    const bo=Number(b.orden??b.prioridad??b.numero??999999);
    if(ao!==bo)return ao-bo;
    return text(a.nombre).localeCompare(text(b.nombre),"es",{sensitivity:"base"});
  });
}

export async function listAdminCatalogV2({cache,tipo,cityId=""}){
  const t=text(tipo).toLowerCase(),def=defs[t];
  if(!def)return{success:false,message:"Catálogo no reconocido."};

  const packet=(await cache.get(ADMIN_KEY))||{};
  let rows=Array.isArray(packet[t])?packet[t]:[];

  if(t==="nodos"&&text(cityId)){
    rows=rows.filter(x=>text(x.ciudad_id)===text(cityId));
  }

  return{success:true,tipo:t,results:sortRows(rows),source:"kv"};
}

export async function saveAdminCatalogV2({db,cache,tipo,item,cityId=""}){
  const t=text(tipo).toLowerCase(),def=defs[t];
  if(!def)throw new Error("Catálogo no reconocido.");
  if(!item||typeof item!=="object")throw new Error("Item inválido.");

  const id=text(item[def.idField]||item.id);
  if(!id)throw new Error("Falta "+def.idField+".");

  const payload={...item,[def.idField]:id,actualizado_en:new Date().toISOString()};
  if(t==="nodos"&&cityId&&!text(payload.ciudad_id))payload.ciudad_id=text(cityId);

  const saved=await db.patch(def.collection,id,payload);

  const admin=(await cache.get(ADMIN_KEY))||{version:2};
  const adminRows=upsert(Array.isArray(admin[t])?admin[t]:[],def.idField,saved);
  await cache.put(ADMIN_KEY,{
    ...admin,
    version:2,
    updated_at:new Date().toISOString(),
    [t]:adminRows
  });

  if(def.moduleKey&&def.moduleField){
    const modulePacket=(await cache.get(def.moduleKey))||{};
    let rows=(Array.isArray(modulePacket[def.moduleField])?modulePacket[def.moduleField]:[])
      .filter(x=>text(x[def.idField]||x.id)!==id);
    if(active(saved))rows.push(saved);

    await cache.put(def.moduleKey,{
      ...modulePacket,
      updated_at:new Date().toISOString(),
      [def.moduleField]:sortRows(rows)
    });
  }

  return{
    success:true,
    tipo:t,
    item:saved,
    firestore_writes:1,
    firestore_reads:0
  };
}
