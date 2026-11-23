#!/usr/bin/env python3
"""Lectura de evidencia AST P3 original (artifact GitHub Actions), sin mutar datos ni reclasificar."""
import json
from pathlib import Path
ROOT=Path("auditorias/temporal/evidencia_paso3_4")
NAMES=("VALIDACION_INDEPENDIENTE_3_4_ACTUAL.json","CONCILIACION_ORIGENES_166.json","CRUCE_989_1691_ACTUAL.json","REVALIDACION_INDIRECTA_1691_ACTUAL.json","CRUCE_DIRECTO_37_ACCIONES.json")
def parts(obj, prefix="", depth=0):
    if depth>2:return
    if isinstance(obj,list):
        if len(obj) in (17,138,166,321,989,1691):
            sample=obj[0] if obj else None
            print("P4_P3_LISTA",json.dumps({"campo":prefix,"cantidad":len(obj),"tipo_primero":type(sample).__name__,"claves":list(sample)[:30] if isinstance(sample,dict) else None,"ejemplo":sample},ensure_ascii=False,default=str)[:2300])
        return
    if isinstance(obj,dict):
        for k,v in obj.items():
            if isinstance(v,(list,dict)):parts(v,prefix+"."+k,depth+1)
for name in NAMES:
    found=list(ROOT.rglob(name))
    if not found:
        print("P4_P3_ARCHIVO_AUSENTE",name)
        continue
    p=found[0]
    d=json.loads(p.read_text())
    desc={"archivo":name,"bytes":p.stat().st_size,"campos":{k:(len(v) if isinstance(v,(list,dict)) else str(v)[:100]) for k,v in list(d.items())[:35]}} if isinstance(d,dict) else {"archivo":name,"tipo":type(d).__name__,"cantidad":len(d)}
    print("P4_P3_ORIGINAL",json.dumps(desc,ensure_ascii=False)[:3800])
    parts(d,name)


    if name in ("REVALIDACION_INDIRECTA_1691_ACTUAL.json","CRUCE_989_1691_ACTUAL.json","CONCILIACION_ORIGENES_166.json"):
        from collections import Counter
        for key in ("resumen","summary"):
            if isinstance(d,dict) and key in d:
                print("P4_P3_RESUMEN",json.dumps({"archivo":name,"valor":d[key]},ensure_ascii=False,default=str)[:10500])
        rows=d.get("funciones",d.get("cases",[]))
        if isinstance(rows,list):
            columns=("clasificacionActual","estadoHistorico","estado","causa","tipo","dictamen","estadoOriginal")
            for col in columns:
                counts=Counter(str(x.get(col,"")) for x in rows if isinstance(x,dict))
                if len(counts)>1:
                    print("P4_P3_DISTRIBUCION",json.dumps({"archivo":name,"campo":col,"conteos":dict(counts)},ensure_ascii=False)[:6000])
            for x in rows[:3]:
                print("P4_P3_MUESTRA",json.dumps({"archivo":name,"registro":x},ensure_ascii=False,default=str)[:2000])


    if name=="REVALIDACION_INDIRECTA_1691_ACTUAL.json":
        clases={
          "cadena_AST_sin_raiz_de_AUD_acreditada":"P3-166-CADENAS-INTERRUMPIDAS",
          "cadena_indirecta_requiere_verificacion_de_receptor":"P3-166-CADENAS-INTERRUMPIDAS",
          "cadena_indirecta_con_identidad_intermedia_no_remapeada":"P3-166-CADENAS-INTERRUMPIDAS",
          "consumidor_AST_identificado_sin_entrada_o_receptor_acreditado":"P3-17-FUNCIONES-SIN-ENTRADA",
          "sin_consumidor_AST_identificado_en_codigo_actual":"P3-138-SIN-CONSUMIDOR-AST"
        }
        rows=[x for x in d["funciones"] if x["clasificacionActual"] in clases]
        assert len(rows)==321 and len(set(x["idASTHistorico"] for x in rows))==321
        for x in rows:
            entry={
                "idASTHistorico":x["idASTHistorico"],
                "idASTActual":x.get("idASTActual"),
                "AUDHistorica":x.get("AUDHistorica"),
                "clasificacionActual":x["clasificacionActual"],
                "grupo_hallazgo":clases[x["clasificacionActual"]],
                "estadoHistorico":x.get("estadoHistorico"),
                "causaOrigenAUD":x.get("origenAUDActual",{}).get("causa") if isinstance(x.get("origenAUDActual"),dict) else None,
                "cadenaActualCandidata":x.get("cadenaActualCandidata",[]),
                "limites":x.get("limites",[])
            }
            print("P4_P3_IDENTIDAD",json.dumps(entry,ensure_ascii=False,separators=(",",":")))
        print("P4_P3_IDENTIDADES_TOTAL",len(rows))
