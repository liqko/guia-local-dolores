import {getEfemCity} from "../core/efemerides-read-model.js";

const text=v=>String(v??"").trim();

function dayNumber(raw){
  const s=text(raw).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const map={DOMINGO:0,LUNES:1,MARTES:2,MIERCOLES:3,JUEVES:4,VIERNES:5,SABADO:6};
  if(Object.prototype.hasOwnProperty.call(map,s))return map[s];
  const n=Number(s);return Number.isInteger(n)&&n>=0&&n<=6?n:-1;
}
function dateFrom(raw){
  const s=text(raw);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const [y,m,d]=s.split("-").map(Number);
    return new Date(y,m-1,d);
  }
  return new Date();
}
function matches(row,date){
  const type=text(row.tipo_fecha).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(type==="FIJA"){
    return Number(row.mes||0)===date.getMonth()+1&&Number(row.dia||0)===date.getDate();
  }
  if(type==="MOVIL"){
    if(Number(row.mes||0)!==date.getMonth()+1)return false;
    if(dayNumber(row.dia_semana)!==date.getDay())return false;
    const raw=text(row.semana_mes).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    if(raw==="ULTIMA"){
      const next=new Date(date);next.setDate(next.getDate()+7);
      return next.getMonth()!==date.getMonth();
    }
    const week=Number(raw||0);
    return Number.isInteger(week)&&week>=1&&week<=5&&Math.floor((date.getDate()-1)/7)+1===week;
  }
  return false;
}
export async function efemeridesPublicV2({cache,cityId,fecha=""}){
  const base=await getEfemCity({cache,cityId});
  if(base.status)return base;
  const date=dateFrom(fecha);
  const key=[
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0")
  ].join("-");
  return{
    success:true,
    ciudad_id:text(cityId),
    fecha:key,
    efemerides:(base.efemerides||[]).filter(x=>matches(x,date))
  };
}
