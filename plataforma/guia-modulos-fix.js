/* Guía Local - refuerzo público de Eventos y Actividades por anunciante */
(function(){
  'use strict';

  const EVENTS_WEBAPP_URL='https://script.google.com/macros/s/AKfycbzD8yRKeWn2B2bMOc7NsoHGzaYon1ifg5sgkeAnmUz8U13t_j_5vDwkHnWz3pk6tp8hmg/exec';
  const EVENTS_SERVER_SECRET='PzbqSEw9xNrwvWruJN7njiW905uwMiBS';
  const EVENTS_PAGE_URL='https://guialocal.ar/eventos/';
  const ACTIVIDADES_ENDPOINT='https://script.google.com/macros/s/AKfycbxnJ0l3wJrSOMf7xk4u63nOfla9PeAzylQbRwIpUSWCpuLcVvd2CKOqhW64qHpnm4zOQQ/exec';

  let eventos=[];
  let actividades=[];

  function norm(v){
    return String(v??'').trim().toLowerCase();
  }

  function truthy(v){
    if(v===true || v===1) return true;
    const s=norm(v);
    return ['true','1','si','sí','yes','activo','publicado','aprobado'].includes(s);
  }

  function extraerLista(resp,keys){
    if(Array.isArray(resp)) return resp;
    for(const k of keys){ if(resp && Array.isArray(resp[k])) return resp[k]; }
    if(resp && resp.data){
      if(Array.isArray(resp.data)) return resp.data;
      for(const k of keys){ if(Array.isArray(resp.data[k])) return resp.data[k]; }
    }
    return [];
  }

  function ids(obj){
    return [
      obj?.id,obj?.__id,obj?.id_comercio,obj?.comercio_id,obj?.id_anunciante,
      obj?.anunciante_id,obj?.advertiserId,obj?.advertiser_id,obj?.advertiserIdVip,
      obj?.organizador_id,obj?.partner_id
    ].map(v=>String(v??'').trim()).filter(Boolean);
  }

  function nombres(obj){
    return [obj?.nombre,obj?.anunciante,obj?.anunciante_nombre,obj?.organizador,obj?.organizador_nombre,obj?.comercio,obj?.nombre_comercio]
      .map(norm).filter(Boolean);
  }

  function cardInfo(actions){
    const card=actions.closest('.card');
    const key=String(actions.dataset.cardActions||'').trim();
    const name=norm(card?.querySelector('.nombre')?.textContent||'');
    return {card,key,name};
  }

  function matches(obj,info){
    const objectIds=ids(obj);
    if(info.key && objectIds.includes(info.key)) return true;
    if(info.name){
      const objectNames=nombres(obj);
      if(objectNames.includes(info.name)) return true;
    }
    return false;
  }

  function eventProgramRows(ev){
    return Array.isArray(ev?.programacion) ? ev.programacion : [];
  }

  function parseDate(v){
    const s=String(v||'').trim();
    if(!s) return null;
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    const d=new Date(s);
    return Number.isNaN(d.getTime())?null:d;
  }

  function eventoVigente(ev){
    if(ev?.activo!==undefined && !truthy(ev.activo)) return false;
    const estado=norm(ev?.estado);
    if(['pausado','borrado','eliminado','rechazado'].includes(estado)) return false;

    const rows=eventProgramRows(ev).filter(r=>r?.activo===undefined || truthy(r.activo));
    const fechas=rows.map(r=>parseDate(r.fecha)).filter(Boolean);
    if(!fechas.length){
      const d=parseDate(ev?.fecha_hasta||ev?.fecha_desde||ev?.fecha);
      if(d) fechas.push(d);
    }
    if(!fechas.length) return true;
    const hoy=new Date(); hoy.setHours(0,0,0,0);
    return fechas.some(d=>{ const x=new Date(d); x.setHours(0,0,0,0); return x>=hoy; });
  }

  function actividadActiva(a){
    if(a?.activo===undefined) return true;
    return truthy(a.activo);
  }

  function esc(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function crearBotonEventos(actions,info,matchesEv){
    if(actions.querySelector('.eventos-activos-btn')) return;
    const count=matchesEv.length;
    if(!count) return;

    const eventIds=matchesEv.map(e=>String(e.evento_id||e.id||'').trim()).filter(Boolean);
    const payload={
      anunciante:info.name||'',
      anunciante_id:info.key||'',
      evento_ids:eventIds,
      ts:Date.now()
    };
    const encoded=encodeURIComponent(JSON.stringify(payload));
    const u=new URL(EVENTS_PAGE_URL);
    if(info.key) u.searchParams.set('advertiser_id',info.key);

    const a=document.createElement('a');
    a.className='eventos-activos-btn';
    a.href=u.toString();
    a.target='_top';
    a.dataset.eventFilter=encoded;
    a.setAttribute('aria-label',`${count===1?'1 evento activo':count+' eventos activos'}${info.name?' de '+info.name:''}`);
    a.innerHTML=`<i class="fas fa-calendar-days"></i> ${count===1?'1 evento activo':count+' eventos activos'}`;
    a.addEventListener('click',()=>{
      try{ localStorage.setItem('gld_eventos_filter',JSON.stringify(payload)); }catch(e){}
    });
    actions.prepend(a);
  }

  function crearBotonActividades(actions,info,matchesAct){
    if(actions.querySelector('.actividades-activas-btn')) return;
    const count=matchesAct.length;
    if(!count) return;

    const payload={
      anunciante:info.name||'',
      anunciante_id:info.key||'',
      actividad_ids:matchesAct.map(a=>String(a.actividad_id||a.id||'').trim()).filter(Boolean),
      ts:Date.now()
    };
    const encoded=encodeURIComponent(JSON.stringify(payload));
    const a=document.createElement('a');
    a.className='actividades-activas-btn';
    a.href='#';
    a.dataset.actividadFilter=encoded;
    a.setAttribute('aria-label',`${count===1?'1 actividad activa':count+' actividades activas'}${info.name?' de '+info.name:''}`);
    a.innerHTML=`<i class="fas fa-bullseye"></i> ${count===1?'1 actividad activa':count+' actividades activas'}`;
    a.addEventListener('click',()=>{
      try{ localStorage.setItem('gld_actividades_filter',JSON.stringify(payload)); }catch(e){}
    });
    actions.append(a);
  }

  function aplicar(){
    document.querySelectorAll('.card-modulos-actions[data-card-actions]').forEach(actions=>{
      const info=cardInfo(actions);
      const ev=eventos.filter(e=>eventoVigente(e)&&matches(e,info));
      const ac=actividades.filter(a=>actividadActiva(a)&&matches(a,info));
      crearBotonEventos(actions,info,ev);
      crearBotonActividades(actions,info,ac);
    });
  }

  function ciudadActual(){
    try{
      const raw=localStorage.getItem('gld_ciudad_contexto');
      if(raw){
        const p=JSON.parse(raw);
        if(typeof p==='string') return p;
        return String(p?.ciudad_id||p?.id||'').trim();
      }
    }catch(e){}
    return String(document.getElementById('selectCiudad')?.value||'').trim();
  }

  async function cargarEventos(){
    const u=new URL(EVENTS_WEBAPP_URL);
    u.searchParams.set('action','getevents');
    u.searchParams.set('serverSecret',EVENTS_SERVER_SECRET);
    u.searchParams.set('_ts',Date.now());
    const r=await fetch(u.toString(),{cache:'no-store'});
    if(!r.ok) throw new Error('Eventos HTTP '+r.status);
    const j=await r.json();
    eventos=extraerLista(j,['events','eventos','items']);
  }

  async function cargarActividades(){
    const u=new URL(ACTIVIDADES_ENDPOINT);
    u.searchParams.set('action','publicas');
    const city=ciudadActual();
    if(city) u.searchParams.set('ciudad_id',city);
    u.searchParams.set('_ts',Date.now());
    const r=await fetch(u.toString(),{cache:'no-store'});
    if(!r.ok) throw new Error('Actividades HTTP '+r.status);
    const j=await r.json();
    actividades=extraerLista(j,['actividades','items']);
  }

  async function recargar(){
    await Promise.allSettled([cargarEventos(),cargarActividades()]);
    aplicar();
  }

  const observer=new MutationObserver(()=>aplicar());
  function init(){
    observer.observe(document.body,{childList:true,subtree:true});
    recargar();
    document.getElementById('selectCiudad')?.addEventListener('change',()=>{
      actividades=[];
      recargar();
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
