/* Prepared cycle: rotation is computed locally, never per date. */
(function(root){
 'use strict';
 const TTL=15*60*1000,OFFSET=3*60*60*1000;
 const stamp=(date,time)=>Date.parse(String(date)+'T'+String(time||'00:00')+':00-03:00');
 function dateTime(ms){const d=new Date(ms-OFFSET);return {fecha:d.toISOString().slice(0,10),hora:d.toISOString().slice(11,16)};}
 function turns(packet,now=Date.now()){
  const current=[],next=[];let boundary=Infinity;
  for(const cycle of packet.ciclos||[]){
   if(cycle.activo===false)continue;
   const parts=[...(cycle.participantes||[])].filter(p=>p&&p.activo!==false&&p.sede_id).sort((a,b)=>Number(a.orden||999999)-Number(b.orden||999999));
   const start=stamp(cycle.fecha_inicio,cycle.hora_inicio),duration=Number(cycle.duracion_horas||24)*3600000,n=parts.length;
   if(!n||!Number.isFinite(start)||!Number.isFinite(duration)||duration<3600000)continue;
   const simultaneous=Math.max(1,Math.min(n,Math.floor(Number(cycle.farmacias_por_turno)||1))),slot=Math.floor((now-start)/duration),sedes=new Map((cycle.sedes||[]).map(s=>[String(s.sede_id||s.id),s]));
   const add=(index,out)=>{const from=start+index*duration,to=from+duration,a=dateTime(from),b=dateTime(to);for(let j=0;j<simultaneous;j++){const part=parts[(index*simultaneous+j)%n],sede=sedes.get(String(part.sede_id));if(sede)out.push({...sede,ciclo_id:cycle.ciclo_id,sede_id:part.sede_id,fecha_desde:a.fecha,hora_desde:a.hora,fecha_hasta:b.fecha,hora_hasta:b.hora,observaciones:cycle.observaciones||''});}};
   if(slot>=0){add(slot,current);add(slot+1,next);boundary=Math.min(boundary,start+(slot+1)*duration);}else{add(0,next);boundary=Math.min(boundary,start);}
  }
  return {current,next,boundary};
 }
 function client({fetchPacket,storage,clock=()=>Date.now()}){
  const memory=new Map(),pending=new Map(),key=city=>'gld_farma_cycle_v139:'+city;
  return {async get(city){
   if(!city)throw Error('No hay ciudad seleccionada');
   let hit=memory.get(city);if(!hit)try{hit=JSON.parse(storage.getItem(key(city))||'null');}catch{}
   if(hit&&hit.data?.ciudad_id===city&&clock()>=hit.ts&&clock()-hit.ts<TTL){memory.set(city,hit);return hit.data;}
   if(pending.has(city))return pending.get(city);
   const work=(async()=>{const data=await fetchPacket(city);if(!data||data.success!==true||data.ciudad_id!==city||!Array.isArray(data.ciclos))throw Error('No se pudo actualizar el ciclo de farmacias');const saved={ts:clock(),data};memory.set(city,saved);try{storage.setItem(key(city),JSON.stringify(saved));}catch{}return data;})();pending.set(city,work);
   try{return await work;}finally{if(pending.get(city)===work)pending.delete(city);}
  }};
 }
 root.GLDFarmCycle={turns,client,TTL};
})(globalThis);
