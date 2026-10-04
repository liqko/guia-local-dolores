import {syncEfemeridePreparedV2} from "../core/efemerides-read-model-v2.js";

const text=v=>String(v??"").trim();
const bool=v=>v===true||v===1||["true","1","si","sí","x"].includes(text(v).toLowerCase());
const norm=v=>text(v).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function sanitize(payload){
  const p=payload&&typeof payload==="object"?payload:{};
  const out={
    efemeride_id:text(p.efemeride_id||p.id),
    tipo:text(p.tipo).toUpperCase(),
    provincia_id:text(p.provincia_id),
    ciudad_id:text(p.ciudad_id),
    tipo_fecha:norm(p.tipo_fecha),
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
    out.semana_mes=norm(p.semana_mes)==="ULTIMA"?"ULTIMA":Number(p.semana_mes||0);
    out.dia_semana=norm(p.dia_semana);
  }
  return out;
}
function validate(d){
  if(!d.tipo)return"Falta tipo";
  if(!d.tipo_fecha)return"Falta tipo_fecha";
  if(!["GENERAL","PROVINCIAL","LOCAL"].includes(d.tipo))return"Tipo de efeméride inválido";
  if(!["FIJA","MOVIL"].includes(d.tipo_fecha))return"Tipo de fecha inválido";
  if(!d.nombre)return"Falta nombre";
  if(d.tipo==="LOCAL"&&!d.ciudad_id)return"Falta ciudad_id";
  if(d.tipo==="PROVINCIAL"&&!d.provincia_id)return"Falta provincia_id";
  if(d.tipo_fecha==="FIJA"&&(!d.mes||!d.dia))return"Faltan mes/dia";
  if(d.tipo_fecha==="MOVIL"&&(!d.mes||!d.semana_mes||!d.dia_semana))return"Faltan datos de fecha móvil";
  if(!Number.isInteger(d.mes)||d.mes<1||d.mes>12)return"Mes inválido";
  if(d.tipo_fecha==="FIJA"){
    const max=new Date(Date.UTC(2000,d.mes,0)).getUTCDate();
    if(!Number.isInteger(d.dia)||d.dia<1||d.dia>max)return"Día inválido";
  }
  if(d.tipo_fecha==="MOVIL"){
    if(d.semana_mes!=="ULTIMA"&&(!Number.isInteger(d.semana_mes)||d.semana_mes<1||d.semana_mes>5))return"Semana inválida";
    if(!["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","0","1","2","3","4","5","6"].includes(d.dia_semana))return"Día de semana inválido";
  }
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
  if(existing&&!canSee(existing,permisos))throw new Error("No autorizado para esta efeméride");

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
