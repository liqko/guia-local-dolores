/** Observación en memoria: no hace consultas ni guarda datos en Firestore/KV. */
export function observeDbV41(db,report){
  const observed={};
  for(const operation of Object.keys(db)){
    observed[operation]=async(...args)=>{
      const collection=String(args[0]||'');
      const key=operation+':'+collection;
      const stat=report.operations[key]||(report.operations[key]={operation,collection,calls:0,documents_returned:0,failures:0});
      stat.calls++;
      try{
        const result=await db[operation](...args);
        if(operation==='get'||operation==='queryEqual'||operation==='listCollection'){
          stat.documents_returned+=Array.isArray(result)?result.length:(result?1:0);
        }
        return result;
      }catch(error){stat.failures++;throw error;}
    };
  }
  return observed;
}

export function observationPathV41(path){
  return String(path).replace(/(\/advertisers\/)[^/]+/g,'$1:id')
    .replace(/(\/subscribers\/)[^/]+/g,'$1:id');
}

/** Resumen visible en Cloudflare; no es un contador de lecturas facturadas. */
export function finishObservationV42(report){
  const totals={read_calls:0,documents_returned:0,write_calls:0,delete_calls:0,failures:0};
  for(const stat of Object.values(report.operations)){
    if(['get','queryEqual','listCollection'].includes(stat.operation)) totals.read_calls+=stat.calls;
    if(stat.operation==='patch')totals.write_calls+=stat.calls;
    if(stat.operation==='delete')totals.delete_calls+=stat.calls;
    totals.documents_returned+=stat.documents_returned;
    totals.failures+=stat.failures;
  }
  report.totals=totals;
  report.message=`GLD ${report.method} ${report.path}${report.action?' action='+report.action:''} | HTTP ${report.status} | consultas ${totals.read_calls}, documentos ${totals.documents_returned}, escrituras ${totals.write_calls}, eliminaciones ${totals.delete_calls}, fallos ${totals.failures}`;
  return report;
}
