import {syncEfemeridePreparedV2} from "../core/efemerides-read-model-v2.js";

const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());

function sanitize(payload){
  const p=payload&&typeof payload==="object"?payload:{};
  const out={
    efemeride_id:text(p.efemeride_id||p.id),
    tipo:text(p.tipo).toUpperCase(),
    provincia_id:text(p.provincia_id),
    ciudad_id:text(p.ciudad_id),
    tipo_fecha:text(p.tipo_fecha).toUpperCase(),
    nombre:text(p.nombre),
    descripcion:String(p.descripcion||""),
    imagen:String(p.imagen||""),
    activo:p.activo===undefined?true:bool(p.activo),
    origen:text(p.origen||"WORKER_FIRESTORE")
  };
  if(out.tipo_fecha==="FIJA"){
    let mes=Number(p.mes||0),dia=Number(p.dia||0);
    if((!mes||!dia)&&p.fecha){
      const m=String(p.fecha).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(m){mes=Number(m[2]);dia=Number(m[3]);}
    }
    out.mes=mes;out.dia=dia;
  }
  if(out.tipo_fecha==="MOVIL"){
    out.mes=Number(p.mes||0);
    out.semana_mes=Number(p.semana_mes||0);
    out.dia_semana=text(p.dia_semana).toUpperCase();
  }
  return out;
}
function validate(d){
  if(!d.tipo)return"Falta tipo";
  if(!d.tipo_fecha)return"Falta tipo_fecha";
  if(!d.nombre)return"Falta nombre";
  if(d.tipo==="LOCAL"&&!d.ciudad_id)return"Falta ciudad_id";
  if(d.tipo==="PROVINCIAL"&&!d.provincia_id)return"Falta provincia_id";
  if(d.tipo_fecha==="FIJA"&&(!d.mes||!d.dia))return"Faltan mes/dia";
  if(d.tipo_fecha==="MOVIL"&&(!d.mes||!d.semana_mes||!d.dia_semana))return"Faltan datos de fecha móvil";
  return"";
}
function canSee(row,p){
  const tipo=text(row.tipo).toUpperCase();
  if(tipo==="GENERAL")return !!p.efemerides_grl;
  if(tipo==="PROVINCIAL")return !!p.efemerides_provincial&&(p.todas_provincias||p.provincias.includes(text(row.provincia_id)));
  if(tipo==="LOCAL")return !!p.efemerides_local&&(p.todas_ciudades||p.ciudades.includes(text(row.ciudad_id)));
  return false;
}

export async function efemSaveV3({db,cache,advertiserId,body,permisos}){
  const payload=body&&body.payload&&typeof body.payload==="object"?body.payload:body||{};
  const reqId=text(payload.efemeride_id||payload.id);
  const existing=reqId?await db.get("efemerides_bis",reqId):null;
  if(reqId&&!existing)throw new Error("Efeméride no encontrada");

  const merged=existing?{...existing,...payload,efemeride_id:reqId}:payload;
  const data=sanitize(merged),err=validate(data);
  if(err)throw new Error(err);
  if(!canSee(data,permisos))throw new Error("No autorizado para esta efeméride");

  const id=reqId||("EFE-"+crypto.randomUUID());
  data.efemeride_id=id;
  data.actualizado_en=new Date().toISOString();
  if(!existing){
    data.creado_en=data.actualizado_en;
    data.creado_por=advertiserId;
  }else{
    if(existing.creado_en)data.creado_en=existing.creado_en;
    if(existing.creado_por)data.creado_por=existing.creado_por;
  }

  const saved=await db.patch("efemerides_bis",id,data,{mustExist:!!existing});
  await syncEfemeridePreparedV2({cache,efemerideId:id,previous:existing,next:saved});
  return{success:true,efemeride:saved};
}

export async function efemToggleV3({db,cache,id,activo,permisos}){
  const existing=await db.get("efemerides_bis",id);
  if(!existing)throw new Error("Efeméride no encontrada");
  if(!canSee(existing,permisos))throw new Error("No autorizado");

  const saved=await db.patch("efemerides_bis",id,{
    activo:!!activo,
    actualizado_en:new Date().toISOString()
  },{mustExist:true});

  await syncEfemeridePreparedV2({cache,efemerideId:id,previous:existing,next:saved});
  return{success:true,efemeride:saved};
}

export async function efemDeleteV3({db,cache,id,permisos}){
  const existing=await db.get("efemerides_bis",id);
  if(!existing)throw new Error("Efeméride no encontrada");
  if(!canSee(existing,permisos))throw new Error("No autorizado");

  await db.delete("efemerides_bis",id,{mustExist:true});
  await syncEfemeridePreparedV2({cache,efemerideId:id,previous:existing,next:null});
  return{success:true,deleted:true,efemeride_id:id};
}
