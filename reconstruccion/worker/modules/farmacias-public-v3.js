import {getFarmCityV2} from "../core/farmacias-read-model-v2.js";

const text=v=>String(v??"").trim();

function parseLocalDateTime(dateStr,timeStr){
  const d=text(dateStr),t=text(timeStr)||"00:00";
  const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const h=t.match(/^(\d{1,2}):(\d{2})/);
  if(!m||!h)return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(h[1]),Number(h[2]),0,0);
}
function fmtDate(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function fmtTime(d){
  return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}
function requestedDay(dateStr){
  const m=text(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  const start=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),0,0,0,0);
  const end=new Date(start.getTime()+24*60*60*1000);
  return{start,end};
}
function gcd(a,b){
  a=Math.abs(a);b=Math.abs(b);
  while(b){const t=b;b=a%b;a=t;}
  return a||1;
}
function sedeMap(cycle){
  return new Map((cycle.sedes||[]).map(s=>[text(s.sede_id||s.id),s]));
}
function sortedParticipants(cycle){
  return [...(cycle.participantes||[])]
    .filter(p=>p&&p.activo!==false&&text(p.sede_id))
    .sort((a,b)=>Number(a.orden||999999)-Number(b.orden||999999));
}
function turnosForCycle(cycle,dateStr,now=Date.now()){
  const parts=sortedParticipants(cycle);
  const n=parts.length;
  if(!n)return[];

  const simultaneous=Math.max(1,Math.min(n,Math.floor(Number(cycle.farmacias_por_turno||1))));
  const durationHours=Math.max(1,Number(cycle.duracion_horas||24));
  const durationMs=durationHours*60*60*1000;
  const cycleStart=parseLocalDateTime(cycle.fecha_inicio,cycle.hora_inicio);
  const day=requestedDay(dateStr);
  if(!cycleStart||!day)return[];

  const firstSlot=Math.floor((day.start.getTime()-cycleStart.getTime())/durationMs)-1;
  const lastSlot=Math.floor((day.end.getTime()-cycleStart.getTime())/durationMs)+1;
  const totalSteps=n/gcd(n,simultaneous);
  const sedes=sedeMap(cycle);
  const rows=[];

  for(let slot=Math.max(0,firstSlot);slot<=Math.max(0,lastSlot);slot++){
    const start=new Date(cycleStart.getTime()+slot*durationMs);
    const end=new Date(start.getTime()+durationMs);
    if(end<=day.start||start>=day.end)continue;

    const step=slot%totalSteps;
    const index=(step*simultaneous)%n;

    for(let j=0;j<simultaneous;j++){
      const part=parts[(index+j)%n];
      const sede=sedes.get(text(part.sede_id));
      if(!sede)continue;

      rows.push({
        ...sede,
        ciclo_id:text(cycle.ciclo_id||cycle.id),
        sede_id:text(sede.sede_id||sede.id),
        fecha_desde:fmtDate(start),
        hora_desde:fmtTime(start),
        fecha_hasta:fmtDate(end),
        hora_hasta:fmtTime(end),
        observaciones:text(cycle.observaciones),
        en_turno_ahora:now>=start.getTime()&&now<end.getTime()
      });
    }
  }

  return rows;
}

export async function farmTurnosPublicV3({cache,cityId,fecha=""}){
  const city=text(cityId);
  const date=text(fecha)||fmtDate(new Date());
  const base=await getFarmCityV2({cache,cityId:city});
  if(base.status)return base;

  const turnos=(base.ciclos||[])
    .filter(c=>c.activo!==false)
    .flatMap(c=>turnosForCycle(c,date))
    .sort((a,b)=>{
      const ka=text(a.fecha_desde)+" "+text(a.hora_desde)+" "+text(a.nombre_sede);
      const kb=text(b.fecha_desde)+" "+text(b.hora_desde)+" "+text(b.nombre_sede);
      return ka.localeCompare(kb,"es",{sensitivity:"base"});
    });

  return{success:true,ciudad_id:city,fecha:date,turnos};
}
