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

// El router público recibe esta barrera, nunca el cliente real de Firestore.
// Si un cambio introduce una consulta accidental, falla antes de ejecutarla.
export function publicDbGuardV44(report){
  return Object.fromEntries(['get','queryEqual','listCollection','patch','delete'].map(operation=>[
    operation, async()=>{
      report.public_blocked=(report.public_blocked||0)+1;
      throw new Error('Acceso a Firestore bloqueado en una ruta pública: '+operation);
    }
  ]));
}

// Sólo etiquetas conocidas; nunca incorporar correo, contraseña ni texto arbitrario.
export async function observationActionV43(request,url){
  let action=url.searchParams.get('action')||'';
  if(url.pathname==='/suscriptores'&&request.method==='POST'){
    try{const body=await request.clone().json();action=body.action||body.accion||action;}catch(_){}
  }
  const allowed=new Set(['ubicaciones','locations','bootstrap','publicas','turnos','efemerides','login',
    'session','favoritos','anunciantes_autorizados','perfil','suscriptor','crear','actualizar_perfil',
    'actualizar_ciudad','cambiar_clave','eliminar_cuenta','agregar_favorito','quitar_favorito',
    'solicitar_recuperacion','restablecer_clave','solicitar_verificacion','confirmar_verificacion']);
  const value=String(action).trim().toLowerCase();
  return allowed.has(value)?value:'';
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
