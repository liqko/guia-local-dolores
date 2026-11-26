/* Shared Farmacias editor: original controls, rotation preview and payload. */
function farmaNombre(f){
  return String(f.nombre_sede || f.nombre_ref || f.sede_id || 'Farmacia').trim();
}

function farmaSelectedRows(){
  return Array.from(document.querySelectorAll('#farma-list .farma-row'))
    .map(row=>{
      const check=row.querySelector('.farma-check');
      const order=row.querySelector('.farma-order');
      return {
        sede_id:String(row.dataset.sedeId || '').trim(),
        checked:!!(check && check.checked),
        orden:Number(order && order.value || 0),
        nombre:String(row.dataset.nombre || '').trim()
      };
    })
    .filter(x=>x.checked && x.sede_id)
    .sort((a,b)=>(a.orden||999999)-(b.orden||999999) || a.nombre.localeCompare(b.nombre,'es'));
}

function normalizeFarmaOrders(){
  const selected=farmaSelectedRows();
  selected.forEach((item,i)=>{
    const row=Array.from(document.querySelectorAll('#farma-list .farma-row'))
      .find(r=>String(r.dataset.sedeId||'')===item.sede_id);
    const input=row && row.querySelector('.farma-order');
    if(input) input.value=String(i+1);
  });
}

function renderFarmaList(){
  const box=document.getElementById('farma-list');
  if(!box) return;
  const selectedMap=new Map((farmaState.participantes||[]).map(p=>[String(p.sede_id||''),Number(p.orden||0)]));
  const rows=(farmaState.farmacias||[]).map((f,idx)=>{
    const sedeId=String(f.sede_id||'').trim();
    const selected=selectedMap.has(sedeId);
    const orden=selected ? selectedMap.get(sedeId) : '';
    const nombre=farmaNombre(f);
    return `<div class="farma-row" data-sede-id="${htmlEscape(sedeId)}" data-nombre="${htmlEscape(nombre)}">
      <input class="farma-check" type="checkbox"${selected?' checked':''} aria-label="Participa ${htmlEscape(nombre)}">
      <div>
        <div class="farma-name">${htmlEscape(nombre)}</div>
        <div class="record-id">Sede ID: ${htmlEscape(sedeId||'SIN ID')}</div>
        ${f.direccion?`<div class="farma-address">${htmlEscape(f.direccion)}</div>`:''}
      </div>
      <input class="farma-order" type="number" min="1" step="1" value="${htmlEscape(orden)}" placeholder="Orden" ${selected?'':'disabled'}>
    </div>`;
  }).join('');
  box.innerHTML=rows || '<div class="small-muted">No hay farmacias disponibles para esta ciudad.</div>';

  box.querySelectorAll('.farma-check').forEach(ch=>{
    ch.addEventListener('change',()=>{
      const row=ch.closest('.farma-row');
      const order=row && row.querySelector('.farma-order');
      if(order){
        order.disabled=!ch.checked;
        if(ch.checked && !String(order.value||'').trim()){
          order.value=String(farmaSelectedRows().length || 1);
        }
        if(!ch.checked) order.value='';
      }
      normalizeFarmaOrders();
      renderFarmaPreview();
    });
  });
  box.querySelectorAll('.farma-order').forEach(inp=>{
    inp.addEventListener('change',()=>{
      normalizeFarmaOrders();
      renderFarmaPreview();
    });
  });
}

function renderFarmaPreview(){
  const box=document.getElementById('farma-preview');
  if(!box) return;

  const participantes=farmaSelectedRows();
  const porTurno=Math.max(1,Math.floor(Number(document.getElementById('farma-simultaneas')?.value||1)));

  if(!participantes.length){
    box.classList.add('hidden');
    box.innerHTML='';
    return;
  }
  if(porTurno>participantes.length){
    box.classList.remove('hidden');
    box.innerHTML='<b>La cantidad simultánea no puede superar la cantidad de farmacias participantes.</b>';
    return;
  }

  const n=participantes.length;
  const gcd=(a,b)=>{ a=Math.abs(a); b=Math.abs(b); while(b){ const t=b; b=a%b; a=t; } return a||1; };
  const dias=n/gcd(n,porTurno);
  const lineas=[];

  for(let paso=0;paso<dias;paso++){
    const nombres=[];
    const inicio=(paso*porTurno)%n;
    for(let j=0;j<porTurno;j++){
      nombres.push(participantes[(inicio+j)%n].nombre);
    }
    lineas.push(`<div class="farma-preview-line"><b>Turno ${paso+1}:</b> ${nombres.map(htmlEscape).join(' + ')}</div>`);
  }

  box.classList.remove('hidden');
  box.innerHTML=`<strong>Vista previa · ${dias} turno${dias===1?'':'s'} hasta volver al inicio</strong>${lineas.join('')}`;
}

function buildFarmaciasPayloadFromForm_(){
  const participantes=farmaSelectedRows().map((p,i)=>({
    sede_id:String(p.sede_id||'').trim(),
    orden:i+1
  }));

  return {
    ciclo_id:farmaState.ciclo&&farmaState.ciclo.ciclo_id?String(farmaState.ciclo.ciclo_id):'',
    ciudad_id:String(document.getElementById('farma-ciudad')?.value||'').trim(),
    fecha_inicio:String(document.getElementById('farma-fecha-inicio')?.value||'').trim(),
    hora_inicio:String(document.getElementById('farma-hora-inicio')?.value||'').trim(),
    duracion_horas:Number(document.getElementById('farma-duracion')?.value||24),
    farmacias_por_turno:Math.floor(Number(document.getElementById('farma-simultaneas')?.value||1)),
    observaciones:String(document.getElementById('farma-observaciones')?.value||'').trim(),
    participantes
  };
}


