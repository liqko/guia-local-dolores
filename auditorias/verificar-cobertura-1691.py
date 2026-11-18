#!/usr/bin/env python3
"""Cotejo reproducible del grupo de cobertura pendiente; no modifica archivos funcionales."""
import json, re, zipfile, os, collections, csv
from pathlib import Path

BASE=Path("auditorias/transversal")
OUT=Path("auditorias/temporal")
OUT.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(BASE/"COBERTURA_ACTIVACIONES.zip") as z:
    document=json.loads(z.read("COBERTURA_ACTIVACIONES.json"))
rows=document["filas"]
catalog_text=(BASE/"CATALOGO_MAESTRO.md").read_text()
valid_ids=set(re.findall(r"AUD-\d{5}",catalog_text))
open_status={"invocador_identificado_sin_entrada","registro_o_asignacion_sin_invocacion_comprobada","declaracion_sin_invocador_resuelto","uso_no_localizado_revision_por_accion"}
pending=[r for r in rows if r.get("estadoDeCobertura") in open_status]
assert len(rows)==3625, len(rows)
assert len(pending)==1691, len(pending)
assert len(valid_ids)==987, len(valid_ids)
known_array={"map","flatMap","filter","forEach","some","every","find","findIndex","findLast","findLastIndex","reduce","reduceRight","sort"}
known_async={"then","catch","finally"}
report=[]
for r in pending:
    act=r.get("activacion") or {}
    parent_units=list(r.get("unidadesDelPadre") or [])
    direct_units=list(r.get("unidades") or [])
    unrecognized=[u for u in parent_units+direct_units if u not in valid_ids]
    if unrecognized:
        raise RuntimeError(f"Referencia AUD inexistente: {r.get('idGPS')} {unrecognized}")
    expr=str(act.get("expr") or "").strip()
    method=(re.search(r"\.([A-Za-z]+)\s*$",expr) or [None,None])[1]
    state=r["estadoDeCobertura"]
    if state=="registro_o_asignacion_sin_invocacion_comprobada" and parent_units and act.get("tipo")=="funcion_pasada_como_argumento" and method in known_array:
        verification="cadena_a_AUD_y_callback_de_metodo_estandar_candidato"
    elif state=="registro_o_asignacion_sin_invocacion_comprobada" and parent_units and act.get("tipo")=="funcion_pasada_como_argumento" and method in known_async:
        verification="cadena_a_AUD_y_callback_de_promesa_condicional"
    elif state=="registro_o_asignacion_sin_invocacion_comprobada" and parent_units:
        verification="padre_en_AUD_sin_activacion_del_callback_confirmada"
    elif state=="invocador_identificado_sin_entrada" and parent_units:
        verification="padre_en_AUD_pero_invocador_sin_entrada"
    else:
        verification="entrada_no_acreditada"
    report.append({
      "idGPS":r.get("idGPS"),"archivo":r.get("archivo"),"linea":r.get("linea"),
      "nombre":r.get("nombre"),"estadoOriginal":state,"clasificacion":verification,
      "expr":expr,"tipoActivacion":act.get("tipo"),"metodoEstandarCandidato":method,
      "unidadesDelPadre":parent_units,"invocadores":r.get("sitiosDeLlamada") or [],
      "condicion":"Enlace estático no implica ejecución ni confirma tipo del receptor"
    })
counts=collections.Counter(x["clasificacion"] for x in report)
source_counts=collections.Counter(x["estadoOriginal"] for x in report)
summary={
  "revision":document["revision"],"catalogoUnidades":len(valid_ids),
  "declaracionesTotal":len(rows),"abiertasOriginales":len(pending),
  "porEstadoOriginal":dict(source_counts),"porEvidenciaAdicional":dict(counts),
  "candidatosRutaYContratoEstandar":sum(v for k,v in counts.items() if k.startswith("cadena_a_AUD_y_callback")),
  "cierreAutomatico":0,
  "nota":"Las rutas vinculadas al padre están en el catálogo; faltan pruebas de tipo/condición/ejecución para acreditar cada callback. No se restan pendientes automáticamente."
}
(OUT/"COBERTURA_1691_CRUCE.json").write_text(json.dumps({"summary":summary,"rows":report},ensure_ascii=False,indent=2)+"\n")
(OUT/"COBERTURA_1691_RESUMEN.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n")
with open(OUT/"COBERTURA_1691_FILAS.csv","w",newline="",encoding="utf-8") as f:
 w=csv.writer(f);w.writerow(["idGPS","archivo","linea","estadoOriginal","clasificacion","unidadesDelPadre","expr"])
 for x in report:w.writerow([x["idGPS"],x["archivo"],x["linea"],x["estadoOriginal"],x["clasificacion"],";".join(x["unidadesDelPadre"]),x["expr"]])
print("COBERTURA_1691_RESULTADO",json.dumps(summary,ensure_ascii=False))
