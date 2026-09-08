/* Guía Local - Eventos VIP: programación detallada opcional */
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
    return '<option value="">Usar ciudad general</option>'+(evLists.ciudades||[]).map(c=>{
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
    return '<option value="">Usar lugar general</option>'+lugaresCiudad(ciudadId).map(x=>{
      const key=lugarKey(x);
      const label=String(x.nombre_visible||x.lugar||'').trim();
      return `<option value="${esc(key)}"${key===selectedKey?' selected':''}>${esc(label)}</option>`;
    }).join('');
  }

  function lugarPorKey(key){
    return (evLists.lugaresTodos||[]).find(x=>lugarKey(x)===String(key||''))||null;
  }

  function datosGenerales(){
    const place=typeof selectedEventPlace==='function'?selectedEventPlace():null;
    return {
      ciudad_id:String(document.getElementById('ev-ciudad')?.value||''),
      sede_id:place?String(place.sede_id||''):'',
      lugar_id:place?String(place.lugar_id||''):'',
      lugar_texto:place?String(place.nombre_visible||place.lugar||''):'',
      direccion:String(document.getElementById('ev-direccion')?.value||''),
      maps:String(document.getElementById('ev-llegar')?.value||'')
    };
  }

  function card(data,index){
    const key=lugarSeleccionadoDesdeData(data);
    const wrap=document.createElement('div');
    wrap.className='evp-card';
    wrap.style.cssText='border:1px solid #e2e5eb;border-radius:10px;padding:12px;margin:10px 0;background:#fafafa';
    wrap.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <strong>Día / horario / sede / actividad ${index+1}</strong>
        <button type="button" class="btn-danger evp-remove" style="width:auto;margin:0">Quitar</button>
      </div>
      <div class="events-grid">
        <div><label>Día <span class="req">*</span></label><input class="evp-fecha" type="date" value="${esc(data.fecha)}"></div>
        <div><label>Actividad / parte del evento</label><input class="evp-actividad" type="text" value="${esc(data.actividad)}" placeholder="Ej.: Apertura, partido, show, charla"></div>
        <div><label>Hora desde</label><input class="evp-desde" type="time" value="${esc(data.hora_desde)}"></div>
        <div><label>Hora hasta</label><input class="evp-hasta" type="time" value="${esc(data.hora_hasta)}"></div>
        <div><label>Ciudad</label><select class="evp-ciudad">${ciudadesOptions(data.ciudad_id)}</select></div>
        <div><label>Lugar / sede</label><select class="evp-lugar">${lugaresOptions(data.ciudad_id,key)}</select></div>
        <div class="full"><label>Detalle</label><input class="evp-detalle" type="text" value="${esc(data.detalle)}" placeholder="Información específica de este tramo"></div>
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
      evProgramacionState=rows;
      renderProgramacion();
    });
    return wrap;
  }

  function leerProgramacion(){
    const general=datosGenerales();
    return Array.from(document.querySelectorAll('#ev-programacion .evp-card')).map((c,index)=>{
      const key=String(c.querySelector('.evp-lugar')?.value||'');
      const l=lugarPorKey(key);
      const ciudadElegida=String(c.querySelector('.evp-ciudad')?.value||'').trim();
      return {
        fecha:String(c.querySelector('.evp-fecha')?.value||'').trim(),
        hora_desde:String(c.querySelector('.evp-desde')?.value||'').trim(),
        hora_hasta:String(c.querySelector('.evp-hasta')?.value||'').trim(),
        ciudad_id:ciudadElegida||general.ciudad_id,
        tipo_lugar:l?String(l.tipo||'').trim():'',
        sede_id:l?String(l.sede_id||'').trim():general.sede_id,
        lugar_id:l?String(l.lugar_id||'').trim():general.lugar_id,
        lugar_texto:l?String(l.nombre_visible||l.lugar||'').trim():general.lugar_texto,
        direccion:l?String(l.direccion||'').trim():general.direccion,
        maps:l?String(l.llegar||l.maps||'').trim():general.maps,
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
    box.innerHTML='';
    if(!evProgramacionState.length){
      box.innerHTML='<div class="events-small" style="padding:10px 0">Sin programación detallada. Si el evento es simple, alcanza con los datos generales de arriba.</div>';
      return;
    }
    evProgramacionState.forEach((r,i)=>box.appendChild(card(r,i)));
  }

  function cargarProgramacion(evento){
    const rows=Array.isArray(evento&&evento.programacion)?evento.programacion:[];
    evProgramacionState=rows.map(filaBase);
    renderProgramacion();
  }

  function validar(rows){
    for(let i=0;i<rows.length;i++){
      if(!rows[i].fecha) return `Programación ${i+1}: falta el día.`;
      if(!rows[i].hora_desde&&!rows[i].hora_hasta&&!rows[i].actividad&&!rows[i].detalle){
        return `Programación ${i+1}: completá al menos horario, actividad o detalle.`;
      }
    }
    return '';
  }

  function instalarUI(){
    if(document.getElementById('ev-programacion-wrap')) return;
    const fechaHasta=document.getElementById('ev-fecha_hasta');
    const anchor=fechaHasta&&(fechaHasta.parentElement||fechaHasta.closest('.full'));
    if(!anchor) return;

    const section=document.createElement('div');
    section.id='ev-programacion-wrap';
    section.className='full';
    section.innerHTML=`
      <div class="act-help-box small-muted" style="margin-top:12px">
        <strong>Programación detallada (opcional).</strong><br>
        La fecha desde/hasta y el lugar de arriba describen el evento en general.<br>
        Usá esta sección cuando el evento tenga distintos días, horarios, sedes o actividades. Agregá un bloque por cada combinación. Si varios bloques ocurren en el mismo lugar, podés usar el lugar general.
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px">
        <strong>Días, horarios, sedes y actividades</strong>
        <button id="ev-add-programacion" type="button" class="secondary" style="width:auto">+ Agregar día / horario / sede / actividad</button>
      </div>
      <div id="ev-programacion"></div>`;
    anchor.insertAdjacentElement('afterend',section);
    evProgramacionState=[];
    renderProgramacion();

    document.getElementById('ev-add-programacion').addEventListener('click',()=>{
      evProgramacionState=leerProgramacion();
      const g=datosGenerales();
      evProgramacionState.push(filaBase({
        fecha:document.getElementById('ev-fecha_desde')?.value||'',
        ciudad_id:g.ciudad_id,
        sede_id:g.sede_id,
        lugar_id:g.lugar_id,
        lugar_texto:g.lugar_texto,
        direccion:g.direccion,
        maps:g.maps
      }));
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
    /* Los datos generales quedan exactamente como los cargó el anunciante.
       La programación NO pisa fecha_desde, fecha_hasta, lugar, sede, dirección ni horas generales. */
    return payload;
  };

  const originalClear=window.clearEventForm;
  window.clearEventForm=function(){
    originalClear();
    evProgramacionState=[];
    renderProgramacion();
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
      /* La duplicación real la resuelve el backend y conserva sus filas hijas. */
      return;
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

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',instalarUI,{once:true});
  else instalarUI();
})();
