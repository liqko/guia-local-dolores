import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
let source=readFileSync(new URL('./base-activa138.mjs',import.meta.url),'utf8');
const anchor='    if (action === "turnos") {\n      const out2 = await farmTurnosPublicV3({';
if(source.split(anchor).length!==2)throw Error('Farmacias route changed');
source=source.replace(anchor,`    if(action==='ciclo'){
      const city=String(url.searchParams.get('ciudad_id')||'').trim();
      if(!city)return json({success:false,message:'ciudad_id obligatorio'},400);
      const packet=await cache.get(farmCityKeyV2(city));
      if(!packet)return json({success:false,message:'El ciclo de esta ciudad todavía no está publicado.'},503);
      return json({success:true,version:139,ciudad_id:city,updated_at:packet.updated_at||'',ciclos:(packet.ciclos||[]).map(c=>({ciclo_id:c.ciclo_id||c.id,fecha_inicio:c.fecha_inicio,hora_inicio:c.hora_inicio,duracion_horas:c.duracion_horas,farmacias_por_turno:c.farmacias_por_turno,activo:c.activo,observaciones:c.observaciones,participantes:(c.participantes||[]).map(p=>({sede_id:p.sede_id,orden:p.orden,activo:p.activo})),sedes:c.sedes||[]}))},200,{'Cache-Control':'no-store'});
    }
`+anchor);
const sync='  await syncFarmCyclePreparedV2({';
if(source.split(sync).length!==2)throw Error('Save-cycle anchor changed');
source=source.replace(sync,`  if(!Object.keys(patch).length&&!participantsChanged)return{success:true,ciclo_id:id,ciclo:{...saved,participantes,sedes},updated:false};
`+sync);
source=source.replaceAll("worker_version:'138'","worker_version:'139'").replace('version:"138"','version:"139"');
writeFileSync(new URL('./login-farmacias139.mjs',import.meta.url),source);
console.log(JSON.stringify({sha256:createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source)}));
