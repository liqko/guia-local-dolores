#!/usr/bin/env python3
"""Certifica evidencia de cobertura estática: identidad AST, sitio real, contrato y unidad AUD.
No prueba ejecución ni cambia archivos funcionales."""
import json,zipfile,re,collections
from pathlib import Path
base=Path('auditorias/transversal')
with zipfile.ZipFile(base/'COBERTURA_ACTIVACIONES.zip') as z:
    doc=json.loads(z.read('COBERTURA_ACTIVACIONES.json'))
rows=doc['filas']
catalog=(base/'CATALOGO_MAESTRO.md').read_text()
ids=set(re.findall(r'AUD-\d{5}',catalog))
known={'map','flatMap','filter','forEach','some','every','find','findIndex','findLast','findLastIndex','reduce','reduceRight','sort','then','catch','finally'}
records=[]
for r in rows:
    a=r.get('activacion') or {}
    parents=r.get('unidadesDelPadre') or []
    if (r.get('estadoDeCobertura')!='registro_o_asignacion_sin_invocacion_comprobada' or
        a.get('tipo')!='funcion_pasada_como_argumento' or not parents): continue
    expr=str(a.get('expr') or '').strip()
    m=re.search(r'\.([A-Za-z]+)\s*$',expr)
    if not m or m.group(1) not in known:continue
    file=Path('baseline')/r['archivo'];line=int(r['linea']);method=m.group(1)
    if not file.exists():
        status='fuente_ausente'
        nearby=''
    else:
        lines=file.read_text().splitlines()
        nearby='\n'.join(lines[max(0,line-4):min(len(lines),line+4)])
        # El origen se obtiene del código real, no del resumen.
        if line<1 or line>len(lines): status='linea_fuera_de_rango'
        elif not re.search(r'\.\s*'+re.escape(method)+r'\s*\(',nearby):status='metodo_no_visible_en_fuente'
        elif not re.search(r'=>|\bfunction\b',nearby):status='callback_no_visible_en_fuente'
        elif any(x not in ids for x in parents):status='id_AUD_inexistente'
        else:status='conexion_estatica_comprobada'
    records.append({
        'idGPS':r['idGPS'],'archivo':r['archivo'],'linea':line,'metodo':method,
        'status':status,'unidadesAUD':parents,'expresion':expr,
        'nota':'Una llamada de método con callback en el código enlaza estructuralmente la función; su activación real y tipo del receptor se comprobarán en ejecución.'
    })
cnt=collections.Counter(x['status'] for x in records)
summary={'revision':doc['revision'],'examinadas':len(records),'resultados':dict(cnt),
         'evidencia':'fuente exacta + callback + método + AUD existente',
         'cierre':'Cobertura estructural solamente, sin afirmar ejecución ni consumo.'}
print('CERTIFICACION_608',json.dumps(summary,ensure_ascii=False))
out=Path('auditorias/temporal');out.mkdir(exist_ok=True)
(out/'CERTIFICACION_CALLBACKS_1691.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n')
