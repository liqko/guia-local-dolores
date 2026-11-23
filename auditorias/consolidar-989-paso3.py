#!/usr/bin/env python3
"""Consolidación Paso3: identidad de acción no equivale a función invocada."""
import collections,json
from pathlib import Path
base=Path("auditorias/temporal")
model=json.loads((base/"MODELO_COBERTURA_989.json").read_text())
ins=json.loads((base/"CONCILIACION_ORIGENES_166.json").read_text())
tree=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
funcs={x["id"]:x for x in tree["functionGraph"]}
by={x["AUD"]:x for x in ins["cases"]}
assert len(by)==166
ct=collections.Counter();related=[]
for row in model["acciones"]:
    aid=row["AUD"];prev=row["estado"]
    c=by.get(aid)
    if c is None:
        now=prev;ev=None
    elif c["correspondenciaArbol"]=="sin_correspondencia_unica":
        now="origen_sin_correspondencia_unica_en_arbol_actual"
        ev={"historico":row["start"],"nuevo":None,"criterio":"cotejo por ID y descriptor de origen fallido"}
    else:
        act=c["receptorArbol"]
        assert act and act["file"]==row["file"] and act["kind"]==row["start"]["kind"]
        current=act.get("entry")
        if current in funcs:
            now="receptor_vigente_con_funcion_AST_concreta"
            assert funcs[current]["file"]==act["file"]
        elif act["kind"]=="startup_call":
            now="inicializacion_actual_sin_funcion_AST_individual"
        elif act["kind"] in ("html_handler","generated_markup","event_property"):
            now="control_actual_sin_funcion_AST_individual"
        else:
            now="entrada_actual_sin_receptor_AST_individual"
        ev={"historico":row["start"],"nuevo":act,
            "criterio":c["correspondenciaArbol"],
            "funcionAST":current if current in funcs else None,
            "limite":"Origen localizado en el árbol; no acredita disparo efectivo ni éxito de la acción"}
    ct[now]+=1
    related.append({**row,"estadoConsolidado":now,"evidenciaArbolActual":ev})
assert len(related)==989
verified=sum(1 for r in related if r["estadoConsolidado"] in (
  "origen_AST_en_fuente_inalterada","origen_AST_remapeado_por_cuerpo",
  "receptor_vigente_con_funcion_AST_concreta"))
unmatched=[r["AUD"] for r in related if r["estadoConsolidado"]=="origen_sin_correspondencia_unica_en_arbol_actual"]
print("PASO3_CONSOLIDADO_989",json.dumps({
  "acciones":989,"origenFuncionAST":verified,
  "casosSinCorrespondenciaArbol":unmatched,
  "estados":dict(sorted(ct.items())),
  "acreditacion":"origen y receptor AST con fuente, sin prueba de ejecución real",
  "funcionesSinEnlaceNuevas":None},ensure_ascii=False))
(base/"MODELO_COBERTURA_989_CONCILIADO.json").write_text(json.dumps({
  "resumen":{"acciones":989,"origenFuncionAST":verified,
    "casosSinCorrespondenciaArbol":unmatched,"estados":dict(sorted(ct.items())),
    "saldoActualFuncionesSinEnlace":None},
  "acciones":related},ensure_ascii=False,indent=2)+"\n")
