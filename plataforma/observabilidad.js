const API='https://login.liqkoargentina.workers.dev/superadmin/telemetry';
const $=id=>document.getElementById(id);
let rows=[],cursor=0,olderCursor=0,moreBefore=false,day='',busy=false,liveTimer=null;
const seen=new Set();
const fmt=n=>n==null?'Sin medir':new Intl.NumberFormat('es-AR').format(n);
const fsKeys=['read_calls','write_calls','delete_calls'];
const kvKeys=['get_calls','put_calls','delete_calls','list_calls'];
const sqlKeys=['rows_read','rows_written'];
function totals(records,group,key){
  if(!records.length)return {value:null,missing:0};
  let value=0,missing=0;
  for(const r of records){const n=group?r.counters?.[group]?.[key]:r.counters?.[key];if(typeof n==='number')value+=n;else missing++;}
  return {value,missing};
}
const present=t=>t.value===null?'Sin medir':fmt(t.value)+(t.missing?' + '+t.missing+' sin medir':'');
function cell(tr,text,tag='td'){const el=document.createElement(tag);el.textContent=text;tr.appendChild(el);return el;}
function groups(){
  const map=new Map();
  for(const row of rows){const key=row.action_id||row.request_id||row.id;if(!map.has(key))map.set(key,[]);map.get(key).push(row);}
  return [...map.entries()].map(([id,rs])=>({id,rows:rs,server:rs.filter(r=>r.source==='server'),browser:rs.filter(r=>r.source==='browser'),at:Math.min(...rs.map(r=>r.at))})).sort((a,b)=>b.at-a.at);
}
function render(){
  const iface=$('interface').value,filter=$('filter').value;
  const all=groups().filter(g=>!iface||g.rows.some(r=>r.interface===iface));
  const list=all.filter(g=>!filter||filter==='error'&&g.rows.some(r=>r.status>=400||['runtime_error','network_error','gap'].includes(r.kind))||filter==='firestore'&&g.server.some(r=>fsKeys.some(k=>r.counters?.firestore?.[k]>0))||filter==='sql'&&g.server.some(r=>r.counters?.sql?.rows_read>0)||filter==='missing'&&g.rows.some(r=>r.coverage==='INCOMPLETO'||r.kind==='resource'&&r.transfer_bytes===null));
  // Compare only like-for-like observed actions, never label a deviation a defect.
  const baseline=new Map();
  for(const g of all){const a=g.browser.find(r=>r.kind==='action');if(!a||!g.server.length)continue;const key=a.interface+'|'+a.page+'|'+a.action;const value=totals(g.server,'sql','rows_read');if(value.missing)continue;if(!baseline.has(key))baseline.set(key,[]);baseline.get(key).push(value.value);g.baselineKey=key;}
  $('stats').replaceChildren();
  const srv=all.flatMap(g=>g.server),res=all.flatMap(g=>g.browser.filter(r=>r.kind==='resource'));
  for(const [label,value] of [['Acciones registradas',fmt(all.length)],['Solicitudes Worker',present(totals(srv,null,'worker_requests'))],['Lecturas KV',present(totals(srv,'kv','get_calls'))],['Filas SQL leídas',present(totals(srv,'sql','rows_read'))]]){
    const item=document.createElement('div');item.className='stat';item.append(document.createTextNode(label));const strong=document.createElement('strong');strong.textContent=value;item.append(strong);$('stats').append(item);
  }
  $('actions').replaceChildren();
  if(!list.length)$('actions').textContent='No hay acciones para los filtros seleccionados.';
  for(const g of list){
    const detail=document.createElement('details');detail.className='row';const summary=document.createElement('summary');
    const action=g.browser.find(r=>r.kind==='action');
    summary.textContent=new Date(g.at).toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})+' · '+(action?.action||g.server[0]?.action||g.server[0]?.path||'Carga de recurso')+' · '+(action?.page||g.server[0]?.page||'Sin página identificada');
    const badge=document.createElement('span');badge.className='pill';badge.textContent=fmt(g.server.length)+' ejecuciones servidor';summary.append(badge);
    if(g.rows.some(r=>r.status>=400||['runtime_error','network_error','gap'].includes(r.kind))){const b=document.createElement('span');b.className='pill bad';b.textContent='Revisar error';summary.append(b);}
    const samples=baseline.get(g.baselineKey)||[],sorted=[...samples].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
    if(samples.length>=5&&totals(g.server,'sql','rows_read').value>Math.max(10,median*3)){const b=document.createElement('span');b.className='pill bad';b.textContent='Consumo SQL fuera del patrón observado';summary.append(b);}
    detail.append(summary);
    const table=document.createElement('table');const head=document.createElement('tr');['Componente','Lecturas','Escrituras','Borrados','Listados'].forEach(x=>cell(head,x,'th'));table.append(head);
    for(const [label,group,keys] of [['Firestore: llamadas','firestore',fsKeys],['Firestore: facturación','firestore',['billed_reads','billed_writes','billed_deletes']],['KV','kv',kvKeys],['SQL público: filas','sql',sqlKeys],['SQL administrativo: filas','admin_sql',sqlKeys]]){
      const tr=document.createElement('tr');cell(tr,label);for(let i=0;i<4;i++)cell(tr,keys[i]?present(totals(g.server,group,keys[i])):'No aplica');table.append(tr);
    }
    const wrap=document.createElement('div');wrap.className='table';wrap.append(table);detail.append(wrap);
    const resources=g.browser.filter(r=>r.kind==='resource'),known=resources.filter(r=>r.transfer_bytes!==null);
    const p=document.createElement('p');p.textContent='Worker: '+present(totals(g.server,null,'worker_requests'))+' solicitudes. Recursos: '+resources.length+'; '+fmt(known.reduce((n,r)=>n+r.transfer_bytes,0))+' bytes observados'+(known.length<resources.length?' + '+(resources.length-known.length)+' recursos sin medir.':'.')+' CPU y facturación DO: sin medir.';detail.append(p);
    const lines=document.createElement('pre');lines.textContent=g.rows.map(r=>r.source==='server'?[r.internal?'Interna':'HTTP',r.method,r.path,r.status,'traza '+r.request_id].join(' '):r.kind==='resource'?['Recurso',r.resource_type,r.host,fmt(r.transfer_bytes)+' bytes','asociación temporal'].join(' · '):[r.kind,r.action,r.control||''].join(' · ')).join('\n');detail.append(lines);
    $('actions').append(detail);
  }
  $('meter').textContent=JSON.stringify({registros_cargados:rows.length,bytes_recursos_observados:res.reduce((n,r)=>n+(r.transfer_bytes||0),0),ultima_consulta:window.lastTelemetryMeter||null,costos_de_guardado:'En registros Cloudflare: gld_telemetry_overhead. No incluidos en totales de negocio.'},null,2);
}
async function refresh(reset=false,older=false){
  if(busy)return;busy=true;$('refresh').disabled=true;$('more').disabled=true;
  try{
    const nextDay=$('day').value;
    if(reset||day!==nextDay){rows=[];seen.clear();cursor=0;olderCursor=0;moreBefore=false;day=nextDay;}
    const token=localStorage.getItem('gld_superadmin_token')||'';
    if(!token)throw Error('Ingresá primero a Gran Hermano en este navegador.');
    const u=new URL(API);u.searchParams.set('day',day);u.searchParams.set('cursor',String(cursor));
    if(older)u.searchParams.set('before',String(olderCursor));
    const r=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const body=await r.json().catch(()=>({}));if(!r.ok||!body.success)throw Error(body.message||'No se pudo consultar el registro.');
    for(const row of body.rows||[])if(!seen.has(row.id)){seen.add(row.id);rows.push(row);}
    cursor=Math.max(cursor,body.cursor||0);if(body.older_cursor)olderCursor=olderCursor?Math.min(olderCursor,body.older_cursor):body.older_cursor;
    if(older||cursor===body.cursor&&rows.length<=300)moreBefore=!!body.more_before;
    window.lastTelemetryMeter=body.meter;
    $('more').hidden=!moreBefore;
    $('message').textContent=body.more?'Hay más registros: cargalos para completar el período.':'Actualizado. Se conservan hasta 72 horas; el envío desde los navegadores puede demorar unos segundos.';
    render();
  }catch(error){$('message').textContent=error.message;$('message').classList.add('bad');}
  finally{busy=false;$('refresh').disabled=false;$('more').disabled=false;}
}
$('day').value=new Date().toISOString().slice(0,10);
$('refresh').onclick=()=>refresh();$('more').onclick=()=>refresh(false,true);$('day').onchange=()=>refresh(true);
$('interface').onchange=render;$('filter').onchange=render;
$('live').onchange=()=>{clearInterval(liveTimer);if($('live').checked)liveTimer=setInterval(()=>refresh(),15000);};
refresh(true);
