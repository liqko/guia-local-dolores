import {getPublicityCityV2} from "../core/publicity-read-model-v2.js";
import {getPublicidadCatalogs} from "../core/catalogs.js";

const text=v=>String(v??"").trim();
const norm=v=>text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\s_-]+/g,"");
const bool=v=>v===true||v===1||["true","1","si","sí","x","activo","activa","aprobado","aprobada"].includes(text(v).toLowerCase());

function parseDate(v){
  const s=text(v);
  if(!s)return null;
  const d=new Date(s);
  return Number.isFinite(d.getTime())?d.getTime():null;
}
function valid(p,now=Date.now()){
  const desde=parseDate(p&&p.vigente_desde),hasta=parseDate(p&&p.vigente_hasta);
  if(desde!==null&&now<desde)return false;
  if(hasta!==null&&now>hasta)return false;
  return true;
}
function isPublic(p){
  return text(p&&p.estado).toUpperCase()==="ACTIVA" &&
    bool(p&&p.aprobado) &&
    valid(p);
}
function activeSeg(s){
  return s&&((s.activo===undefined&&s.activa===undefined)||bool(s.activo??s.activa));
}
function activeMedia(m){
  return m&&((m.activo===undefined&&m.activa===undefined)||bool(m.activo??m.activa));
}

export async function publicidadPublicaV3({cache,cityId,moduleName,categoryId=""}){
  const city=text(cityId),mod=text(moduleName).toUpperCase(),cat=text(categoryId);
  if(!city||!mod)return{success:false,message:"Faltan ciudad_id o modulo.",publicidades:[],status:400};

  const [packet,catalogs]=await Promise.all([
    getPublicityCityV2({cache,cityId:city}),
    getPublicidadCatalogs(cache)
  ]);
  if(packet.status)return packet;

  const ubicaciones=new Set(
    (catalogs.ubicaciones||[])
      .filter(u=>norm(u.modulo)===norm(mod))
      .map(u=>text(u.ubicacion_id||u.id))
      .filter(Boolean)
  );

  const rows=(packet.publicidades||[])
    .filter(isPublic)
    .map(p=>{
      const seg=(Array.isArray(p.segmentacion)?p.segmentacion:[])
        .filter(activeSeg)
        .filter(s=>text(s.ciudad_id)===city)
        .filter(s=>ubicaciones.has(text(s.ubicacion_id)))
        .filter(s=>!cat||text(s.categoria_id)===cat);

      if(!seg.length)return null;

      const media=(Array.isArray(p.media)?p.media:[])
        .filter(activeMedia)
        .sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));

      const first=media[0]||{};
      const tipo=text(first.tipo_media||p.formato).toUpperCase();
      const url=text(first.url);

      return {
        ...p,
        media,
        segmentacion:seg,
        ciudad_id:city,
        img:tipo==="IMAGEN"?url:"",
        media_url:tipo==="IMAGEN"?"":url,
        cta:text(p.cta_destino||p.cta),
        poster:text(first.poster||p.poster)
      };
    })
    .filter(Boolean);

  return{success:true,ciudad_id:city,modulo:mod,categoria_id:cat,publicidades:rows};
}
