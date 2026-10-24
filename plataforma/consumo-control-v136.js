/* Shared with the browser bundle; contains no requests or storage writes. */
(function(root){
  'use strict';
  const quotas={worker_requests:[10000000,'mes'],kv_reads:[10000000,'mes'],kv_writes:[1000000,'mes'],kv_deletes:[1000000,'mes'],kv_lists:[1000000,'mes'],sql_reads:[25000000000,'mes'],sql_writes:[50000000,'mes'],do_requests:[1000000,'mes'],fs_reads:[50000,'día'],fs_writes:[20000,'día'],fs_deletes:[20000,'día']};
  const number=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:null;
  const add=(...values)=>values.some(x=>number(x)===null)?null:values.reduce((a,b)=>a+b,0);
  function metrics(row){
    const m=row.consumo;
    if(!m||m.schema!==136||m.request_id!==row.request_id||String(m.version)!==String(row.version))return null;
    const c=m.cloudflare,f=m.firestore;
    if(!c?.kv||!c.public_store||!c.admin_store||!f||!m.coverage||!Array.isArray(c.public_store.components)||!Array.isArray(m.coverage.missing))return null;
    return {fs_reads:number(f.billed_reads),fs_writes:number(f.billed_writes),fs_deletes:number(f.billed_deletes),fs_read_calls:number(f.read_calls),fs_write_calls:number(f.write_calls),fs_delete_calls:number(f.delete_calls),documents:number(f.documents_returned),kv_direct_reads:number(c.kv.get_calls),kv_actor_reads:number(c.public_store.legacy_gets),kv_reads:add(c.kv.get_calls,c.public_store.legacy_gets),kv_writes:number(c.kv.put_calls),kv_deletes:number(c.kv.delete_calls),kv_lists:add(c.kv.list_calls,c.public_store.legacy_lists),sql_reads:add(c.public_store.rows_read,c.admin_store.rows_read),sql_writes:add(c.public_store.rows_written,c.admin_store.rows_written),do_requests:add(c.public_store.calls,c.admin_store.calls),worker_requests:number(c.worker_requests),failures:add(f.failures,c.kv.failures),components:c.public_store.components};
  }
  function audit(rows,session){
    const issues=[],selected=session?rows.filter(r=>r.prueba===session.id):[];
    if(!session)issues.push('Iniciá una medición para separar esta acción de las anteriores.');
    if(session&&!session.ended_at)issues.push('La medición está abierta.');
    if(session?.capture_errors?.length)issues.push('No se pudo guardar algún registro local.');
    if(!selected.length)issues.push('No hay respuestas registradas para esta acción.');
    const expected=session?.kind==='guia'?['/guide','/farmacias','/efemerides','/publicidad']:[];
    if(session?.kind==='guia'&&(session.authenticated||selected.some(r=>r.ruta==='/suscriptores'&&['perfil','favoritos'].includes(r.accion))))expected.push('/suscriptores:perfil','/suscriptores:favoritos');
    for(const requirement of expected){const [path,action]=requirement.split(':');if(!selected.some(r=>r.ruta===path&&r.metodo==='GET'&&(!action||r.accion===action)))issues.push('Falta '+requirement);}
    const totals={},seen=new Set(),details=[];
    for(const row of selected){
      if(row.estado==='EN CURSO')issues.push('Respuesta en curso: '+row.ruta);
      if(typeof row.estado!=='number'||row.estado<200||row.estado>=400||row.resultado==='Rechazada'||row.vista==='Error')issues.push('Error en '+row.ruta);
      if(!row.request_id||seen.has(row.request_id))issues.push('Traza ausente o repetida: '+row.ruta);
      if(row.request_id)seen.add(row.request_id);
      const measured=metrics(row);
      if(!measured){issues.push('Sin contadores compatibles: '+row.ruta);details.push({row,metrics:null});continue;}
      details.push({row,metrics:measured});
      for(const [key,value] of Object.entries(measured))if(key!=='components')totals[key]=Object.hasOwn(totals,key)?add(totals[key],value):value;
      for(const missing of row.consumo.coverage.missing||[])issues.push(row.ruta+': '+missing);
      if(row.consumo.coverage.operation_counters!=='REGISTRADOS')issues.push('Operaciones incompletas: '+row.ruta);
      if(measured.failures!==0)issues.push('Fallos de operaciones en '+row.ruta);
    }
    // A partial sum must never look like the total of the action.
    if(details.some(d=>!d.metrics))for(const key of Object.keys(quotas))totals[key]=null;
    const percentages={};
    for(const [key,[limit,period]]of Object.entries(quotas))percentages[key]={value:number(totals[key])===null?null:totals[key]/limit*100,limit,period};
    return {status:issues.length?'INCOMPLETO':'COMPLETO',issues:[...new Set(issues)],expected,details,totals,percentages,quota_note:'Cuotas de referencia documentadas; no saldo ni factura de la cuenta.'};
  }
  const api={metrics,audit,quotas};root.GLDMeasurement136=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
