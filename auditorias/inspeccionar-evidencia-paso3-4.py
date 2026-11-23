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
