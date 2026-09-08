/* Guía Local - Eventos VIP: programación múltiple */
(function(){
  'use strict';

  let evProgramacionState=[];

  function esc(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function filaBase(data={}){
    return {
      evento_programacion_id:String(data.evento_programacion_id||''),
      fecha:toDateInputValue(data.fecha||'')||'',
      hora_desde:toTimeInputValue(data.hora_desde||data.hora||'')||'',
      hora_hasta:toTimeInputValue(data.hora_hasta||data.hora2||'')||'',
      ciudad_id:String(data.ciudad_id||''),
      tipo_lugar:String(data.tipo_lugar||''),
      sede_id:String(data.sede_id||''),
      lugar_id:String(data.lugar_id||''),
      lugar_texto:String(data.lugar_texto||data.lugar||''),
      direccion:String(data.direccion||''),
      maps:String(data.maps||data.llegar||''),
      actividad:String(data.actividad||''),
      detalle:String(data.detalle||''),
      observaciones:String(data.observaciones||''),
      activo:data.activo===false?false:true,
      orden:Number(data.orden||0)
    };
  }

  function ciudadesOptions(selected=''){
    return '<option value="">Seleccioná la ciudad</option>'+(evLists.ciudades||[]).map(c=>{
      const id=String(c.ciudad_id||'').trim();
      const label=String(c.ciudad_visible||id).trim();
      return `<option value="${esc(id)}"${id===String(selected)?' selected':''}>${esc(label)}</option>`;
    }).join('');
  }

  function lugaresCiudad(ciudadId){
    return (evLists.lugaresTodos||[]).filter(x=>!ciudadId||String(x.ciudad_id||'')===String(ciudadId));
  }

  function lugarKey(x){
    if(x&&x.sede_id) return 'sede:'+String(x.sede_id);
    if(x&&x.lugar_id) return 'lugar:'+String(x.lugar_id);
    return '';
  }

  function lugarSeleccionadoDesdeData(data){
    if(data.sede_id) return 'sede:'+String(data.sede_id);
    if(data.lugar_id) return 'lugar:'+String(data.lugar_id);
    const wanted=String(data.lugar_texto||'').trim().toLowerCase();
    if(!wanted) return '';
    const found=lugaresCiudad(data.ciudad_id).find(x=>String(x.nombre_visible||x.lugar||'').trim().toLowerCase()===wanted);
    return found?lugarKey(found):'';
  }

  function lugaresOptions(ciudadId,selectedKey=''){
    return '<option value="">Seleccioná un lugar</option>'+lugaresCiudad(ciudadId).map(x=>{
      const key=lugarKey(x);
      const label=String(x.nombre_visible||x.lugar||'').trim();
      return `<option value="${esc(key)}"${key===selectedKey?' selected':''}>${esc(label)}</option>`;
    }).join('');
  }

  function lugarPorKey(key){
    return (evLists.lugaresTodos||[]).find(x=>lugarKey(x)===String(key||''))||null;
  }

  function card(data,index){
    const key=lugarSeleccionadoDesdeData(data);
    const wrap=document.createElement('div');
    wrap.className='evp-card';
    wrap.style.cssText='border:1px solid #e2e5eb;border-radius:10px;padding:12px;margin:10px 0;background:#fafafa';
    wrap.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <strong>Fecha / sede / horario ${index+1}</strong>
        <button type="button" class="btn-danger evp-remove" style="width:auto;margin:0">Quitar</button>
      </div>
      <div class="events-grid">
        <div><label>Fecha <span class="req">*</span></label><input class="evp-fecha" type="date" value="${esc(data.fecha)}"></div>
        <div><label>Actividad / deporte</label><input class="evp-actividad" type="text" value="${esc(data.actividad)}" placeholder="Ej.: Fútbol · Equipo A vs Equipo B"></div>
        <div><label>Hora desde</label><input class="evp-desde" type="time" value="${esc(data.hora_desde)}"></div>
        <div><label>Hora hasta</label><input class="evp-hasta" type="time" value="${esc(data.hora_hasta)}"></div>
        <div><label>Ciudad <span class="req">*</span></label><select class="evp-ciudad">${ciudadesOptions(data.ciudad_id)}</select></div>
        <div><label>Lugar / sede <span class="req">*</span></label><select class="evp-lugar">${lugaresOptions(data.ciudad_id,key)}</select></div>
        <div class="full"><label>Detalle</label><input class="evp-detalle" type="text" value="${esc(data.detalle)}" placeholder="Ej.: Cuartos de final"></div>
        <div class="full"><label>Observaciones</label><input class="evp-obs" type="text" value="${esc(data.observaciones)}"></div>
        <div class="full evp-direccion events-small">${esc(data.direccion||'')}</div>
      </div>`;

    const city=wrap.querySelector('.evp-ciudad');
    const place=wrap.querySelector('.evp-lugar');
    city.addEventListener('change',()=>{
      place.innerHTML=lugaresOptions(city.value,'');
      wrap.querySelector('.evp-direccion').textContent='';
    });
    place.addEventListener('change',()=>{
      const l=lugarPorKey(place.value);
      wrap.querySelector('.evp-direccion').textContent=l?String(l.direccion||''):'';
    });
    wrap.querySelector('.evp-remove').addEventListener('click',()=>{
      const rows=leerProgramacion();
      rows.splice(index,1);
      evProgramacionState=rows.length?rows:[filaBase()];
      renderProgramacion();
    });
    return wrap;
  }

  function leerProgramacion(){
    return Array.from(document.querySelectorAll('#ev-programacion .evp-card')).map((c,index)=>{
      const key=String(c.querySelector('.evp-lugar')?.value||'');
      const l=lugarPorKey(key);
      return {
        fecha:String(c.querySelector('.evp-fecha')?.value||'').trim(),
        hora_desde:String(c.querySelector('.evp-desde')?.value||'').trim(),
        hora_hasta:String(c.querySelector('.evp-hasta')?.value||'').trim(),
        ciudad_id:String(c.querySelector('.evp-ciudad')?.value||'').trim(),
        tipo_lugar:l?String(l.tipo||'').trim():'',
        sede_id:l?String(l.sede_id||'').trim():'',
        lugar_id:l?String(l.lugar_id||'').trim():'',
        lugar_texto:l?String(l.nombre_visible||l.lugar||'').trim():'',
        direccion:l?String(l.direccion||'').trim():'',
        maps:l?String(l.llegar||l.maps||'').trim():'',
        actividad:String(c.querySelector('.evp-actividad')?.value||'').trim(),
        detalle:String(c.querySelector('.evp-detalle')?.value||'').trim(),
        observaciones:String(c.querySelector('.evp-obs')?.value||'').trim(),
        activo:true,
        orden:index+1
      };
    });
  }

  function renderProgramacion(){
    const box=document.getElementById('ev-programacion');
    if(!box) return;
    if(!evProgramacionState.length) evProgramacionState=[filaBase()];
    box.innerHTML='';
    evProgramacionState.forEach((r,i)=>box.appendChild(card(r,i)));
  }

  function cargarProgramacion(evento){
    const rows=Array.isArray(evento&&evento.programacion)&&evento.programacion.length
      ? evento.programacion
      : [{
          fecha:evento&&(evento.fecha_desde||evento.fecha)||'',
          hora_desde:evento&&evento.hora||'',
          hora_hasta:evento&&evento.hora2||'',
          ciudad_id:evento&&evento.ciudad_id||'',
          sede_id:evento&&evento.sede_id||'',
          lugar_id:evento&&evento.lugar_id||'',
          lugar_texto:evento&&evento.lugar||'',
          direccion:evento&&evento.direccion||'',
          maps:evento&&evento.llegar||''
        }];
    evProgramacionState=rows.map(filaBase);
    renderProgramacion();
  }

  function validar(rows){
    if(!rows.length) return 'Agregá al menos una fecha/sede/horario.';
    for(let i=0;i<rows.length;i++){
      if(!rows[i].fecha) return `Programación ${i+1}: falta la fecha.`;
      if(!rows[i].ciudad_id) return `Programación ${i+1}: falta la ciudad.`;
      if(!rows[i].lugar_texto) return `Programación ${i+1}: falta el lugar o sede.`;
    }
    return '';
  }

  function resumen(rows){
    const ordenadas=rows.slice().sort((a,b)=>{
      const ka=String(a.fecha||'')+' '+String(a.hora_desde||'');
      const kb=String(b.fecha||'')+' '+String(b.hora_desde||'');
      return ka.localeCompare(kb);
    });
    const first=ordenadas[0]||{};
    const last=ordenadas[ordenadas.length-1]||first;
    return {
      ciudad_id:first.ciudad_id||'',
      lugar:first.lugar_texto||'',
      sede_id:first.sede_id||'',
      lugar_id:first.lugar_id||'',
      direccion:first.direccion||'',
      llegar:first.maps||'',
      fecha_desde:first.fecha||'',
      fecha_hasta:last.fecha||first.fecha||'',
      hora:first.hora_desde||'',
      hora2:first.hora_hasta||''
    };
  }

  function ocultarCamposPlanos(){
    ['ev-ciudad','ev-lugar','ev-direccion-wrapper','ev-llegar','ev-fecha_desde','ev-fecha_hasta','ev-hora','ev-hora2'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      const holder=el.closest('.full')||el.parentElement;
      if(holder) holder.style.display='none';
    });
  }

  function instalarUI(){
    if(document.getElementById('ev-programacion-wrap')) return;
    const desc=document.getElementById('ev-descripcion');
    const anchor=desc&&(desc.closest('.full')||desc.parentElement);
    if(!anchor) return;

    const section=document.createElement('div');
    section.id='ev-programacion-wrap';
    section.className='full';
    section.innerHTML=`
      <div class="act-help-box small-muted" style="margin-top:12px">
        <strong>Un mismo evento puede tener varias fechas, horarios y sedes.</strong><br>
        Agregá cada partido, actividad o bloque de programación dentro del mismo evento.
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <strong>Programación del evento</strong>
        <button id="ev-add-programacion" type="button" class="secondary" style="width:auto">+ Agregar fecha / sede / horario</button>
      </div>
      <div id="ev-programacion"></div>`;
    anchor.insertAdjacentElement('afterend',section);
    ocultarCamposPlanos();
    evProgramacionState=[filaBase()];
    renderProgramacion();

    document.getElementById('ev-add-programacion').addEventListener('click',()=>{
      evProgramacionState=leerProgramacion();
      evProgramacionState.push(filaBase());
      renderProgramacion();
    });
  }

  const originalBuild=window.buildEventPayloadFromForm;
  window.buildEventPayloadFromForm=function(){
    const payload=originalBuild();
    const rows=leerProgramacion();
    payload.programacion=rows;
    const err=validar(rows);
    if(err) payload.__programacion_error=err;
    Object.assign(payload,resumen(rows));
    return payload;
  };

  const originalClear=window.clearEventForm;
  window.clearEventForm=function(){
    originalClear();
    evProgramacionState=[filaBase()];
    renderProgramacion();
  };

  const originalLoadPanel=window.loadEventosPanelData;
  window.loadEventosPanelData=async function(){
    const ok=await originalLoadPanel();
    if(ok){
      const current=leerProgramacion();
      evProgramacionState=(current.length?current:evProgramacionState).map(filaBase);
      renderProgramacion();
    }
    return ok;
  };

  const originalLoadEvents=window.loadEventsUI;
  window.loadEventsUI=async function(){
    const ok=await originalLoadEvents();
    return ok;
  };

  document.addEventListener('click',async e=>{
    const btn=e.target.closest('button[data-ev-action]');
    if(!btn) return;
    const action=btn.dataset.evAction;
    const id=String(btn.dataset.evId||'');
    const found=(window.__lastEvents||[]).find(x=>String(x.evento_id||'')===id);

    if(action==='edit'&&found){
      setTimeout(()=>cargarProgramacion(found),0);
      return;
    }

    if(action==='duplicate'&&found){
      e.preventDefault();
      e.stopImmediatePropagation();
      const cupo=calcularCupoPublicacion(window.__lastEvents||[],sesion.eventos_cant);
      if(!cupo.puedeCrear){
        setMsg('eventos-msg','err',cupo.total>=cupo.totalMax?'Alcanzaste el máximo de eventos guardados.':'Alcanzaste el máximo de eventos activos. Pausá uno para publicar otro.');
        return;
      }
      await runDashboardAction('Duplicando evento...',async()=>{
        setMsg('eventos-msg','ok','Duplicando evento...');
        const res=await events_post({action:'duplicateVipEvent',payload:{evento_id:id}});
        if(res.status===200&&res.json&&(res.json.success||res.json.duplicated)){
          setMsg('eventos-msg','ok','Evento duplicado.');
          await loadEventsUI();
        }else{
          setMsg('eventos-msg','err','No se pudo duplicar el evento.');
        }
      });
    }
  },true);

  document.addEventListener('click',e=>{
    const btn=e.target.closest('#ev-create');
    if(!btn) return;
    const payload=window.buildEventPayloadFromForm();
    if(payload.__programacion_error){
      e.preventDefault();
      e.stopImmediatePropagation();
      setMsg('eventos-msg','err',payload.__programacion_error);
      document.getElementById('ev-programacion-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  },true);

  document.addEventListener('DOMContentLoaded',instalarUI,{once:true});
})();
