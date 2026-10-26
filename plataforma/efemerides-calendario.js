(function(root){
 'use strict';const TTL=24*60*60*1000;
 function matches(row,date){const norm=v=>String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),type=norm(row.tipo_fecha);if(row.activo===false)return false;if(type==='FIJA')return Number(row.mes)===date.getMonth()+1&&Number(row.dia)===date.getDate();if(type!=='MOVIL'||Number(row.mes)!==date.getMonth()+1)return false;const names={DOMINGO:0,LUNES:1,MARTES:2,MIERCOLES:3,JUEVES:4,VIERNES:5,SABADO:6},raw=norm(row.dia_semana),day=Object.hasOwn(names,raw)?names[raw]:Number(raw);if(day!==date.getDay())return false;if(norm(row.semana_mes)==='ULTIMA'){const next=new Date(date);next.setDate(next.getDate()+7);return next.getMonth()!==date.getMonth();}return Number(row.semana_mes)===Math.floor((date.getDate()-1)/7)+1;}
 function client({fetchCalendar,storage,clock=()=>Date.now()}){const memory=new Map(),pending=new Map(),key=city=>'gld_efem_calendar_v140:'+city;return{async get(city){
  let old=memory.get(city);if(!old)try{old=JSON.parse(storage.getItem(key(city))||'null');}catch{}
  if(old?.data?.ciudad_id!==city||!Array.isArray(old?.data?.efemerides)||typeof old?.data?.revision!=='string')old=null;
  if(old&&clock()>=old.ts&&clock()-old.ts<TTL){memory.set(city,old);return old.data;}
  if(pending.has(city))return pending.get(city);
  const work=(async()=>{const result=await fetchCalendar(city,old?.data?.revision||'');if(!result||result.success!==true||result.ciudad_id!==city||typeof result.revision!=='string')throw Error('No se pudo actualizar el calendario');const data=result.unchanged?old?.data:result;if(!data||result.unchanged&&data.revision!==result.revision||!Array.isArray(data.efemerides))throw Error('Calendario incompleto');const saved={ts:clock(),data};memory.set(city,saved);try{storage.setItem(key(city),JSON.stringify(saved));}catch{}return data;})();pending.set(city,work);try{return await work;}finally{if(pending.get(city)===work)pending.delete(city);}
 }};}
 root.GLDEphemeridesCalendar={TTL,matches,client};
})(globalThis);
