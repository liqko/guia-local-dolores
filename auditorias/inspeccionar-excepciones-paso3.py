#!/usr/bin/env python3
"""Paso 4: inspección read-only de anexos P3; nunca interpreta recuentos como errores."""
import json
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent/"transversal"
FILES=("CATALOGO_MAESTRO.zip","CADENAS_DEPENDENCIAS_PASO_3.zip","COBERTURA_ACTIVACIONES.zip")
def describe(x):
    if isinstance(x, list):
        return {"tipo":"lista","largo":len(x),"campos_primero":list(x[0])[:30] if x and isinstance(x[0],dict) else None,
                "identidad_primero":{k:str(x[0][k])[:140] for k in ("id","idGPS","identidad","AUD","archivo","linea","file","line") if x and isinstance(x[0],dict) and k in x[0]}}
    if isinstance(x,dict):
        return {"tipo":"objeto","campos":{k:len(v) if isinstance(v,(list,dict)) else str(v)[:120] for k,v in list(x.items())[:35]},
                "muestras_listas":{k:describe(v) for k,v in x.items() if isinstance(v,list) and v and isinstance(v[0],dict) and len(v)<10000 and k in ("filas","funciones","entradas","excepciones","cadenas","entries","results","pendientes","sinConsumidor","sinEntrada")}}
    return {"tipo":type(x).__name__}
for name in FILES:
    p=ROOT/name
    assert p.exists(),f"Falta anexo original {p}"
    with zipfile.ZipFile(p) as z:
        for item in z.infolist():
            if not item.filename.lower().endswith(".json"):continue
            obj=json.loads(z.read(item))
            print("PASO4_ANEXO_ORIGINAL",json.dumps({"zip":name,"archivo":item.filename,"bytes":item.file_size,"estructura":describe(obj)},ensure_ascii=False)[:18000])
