#!/usr/bin/env python3
"""Paso 3: contrastar las cuatro acciones moderacion 00095-00098 con despacho real.
No implica ejecución ni consumo; no atribuir datos de rutas ajenas."""
import json,zipfile
from pathlib import Path
a=Path('baseline/plataforma/administracion.html').read_text().splitlines()
w=Path('baseline/worker/worker206.txt').read_text().splitlines()
def check(rows,line,needle):
    assert needle in rows[line-1],f'{line}: {needle} ausente'
    return {'linea':line,'evidencia':needle}
with zipfile.ZipFile('auditorias/transversal/CADENAS_DEPENDENCIAS_PASO_3.zip') as z:
    d=json.loads(z.read('CADENAS_DEPENDENCIAS_PASO_3.json'))
actions={x['AUD']:x for x in d['acciones']}
out=[]
for ident,kind,decision in [
    ('AUD-00095','EVENTO','APROBAR'),('AUD-00096','EVENTO','RECHAZAR'),
    ('AUD-00097','ANUNCIANTE','APROBAR'),('AUD-00098','ANUNCIANTE','RECHAZAR')]:
    assert ident in d['rondaCompleta']['pendientes']
    source_line=1238 if kind=='EVENTO' else 1262
    c=[check(a,1125,'async function resolverPendiente'),
       check(a,1146,"'/superadmin/moderation/resolve'"),
       check(a,1155,'if(!r.ok||!j.success)'),
       check(a,source_line,decision)]
    if kind=='EVENTO':
        c.extend([check(w,13218,'GLD_BUSINESS143.dispatch(ctx)'),
                  check(w,13130,"!=='EVENTO'"),
                  check(w,13140,"db.get('eventos'"),
                  check(w,13141,"assertModeratorV72"),
                  check(w,13145,"env.GLD_PUBLIC_CACHE.get"),
                  check(w,13148,"actor.fetch")])
        destination='Worker -> despacho de eventos -> Durable Object; autorizacion, consulta evento y sincronizacion quedan condicionadas'
    else:
        c.extend([check(w,13130,"!=='EVENTO'"),
                  check(w,13243,'routeAdminV11'),
                  check(w,9822,'/superadmin/moderation/resolve'),
                  check(w,9831,'resolvePendingV3'),
                  check(w,9552,'ANUNCIANTE'),
                  check(w,9553,'solicitudes_anunciante')])
        c.append(check(w,9584 if decision=='APROBAR' else 9569,'db.patch'))
        destination='Worker -> routeAdminV11 -> resolvePendingV3 -> solicitud anunciante; escritura segun decision y modo'
    out.append({'accion':ident,'entrada':actions[ident]['entrada'],
                'tipo':kind,'decision':decision,'destino':destination,
                'evidencia':c,'estado':'despacho_condicionado_verificado',
                'pendiente':'Cotejar otros sitios candidatos del árbol e inspeccionar las dependencias profundas y condiciones según caso antes de dar por cerrada la acción.'})
Path('auditorias/temporal').mkdir(parents=True,exist_ok=True)
Path('auditorias/temporal/MODERACION_4_RUTAS.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('MODERACION_4_RUTAS',json.dumps({'trazadas':len(out),'AUD':[x['accion'] for x in out],
    'advertencia':'Enlaces al despacho demostrados, no cierre de toda la acción, ni consumos reales.'},ensure_ascii=False))
