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
        if current in funcs and not funcs[current].get("synthetic"):
            now="receptor_vigente_con_funcion_AST_concreta"
            assert funcs[current]["file"]==act["file"]
        elif current in funcs and funcs[current].get("synthetic"):
            now="inicio_sintetico_con_receptor_actual_sin_funcion_JS"
            assert act["kind"]=="startup_call", (aid,act["kind"])
        elif act["kind"]=="startup_call":
            now="inicializacion_actual_sin_funcion_AST_individual"
        elif act["kind"] in ("html_handler","generated_markup","event_property"):
            now="control_actual_sin_funcion_AST_individual"
        else:
            now="entrada_actual_sin_receptor_AST_individual"
        ev={"historico":row["start"],"nuevo":act,
            "criterio":c["correspondenciaArbol"],
            "funcionAST":current if current in funcs and not funcs[current].get("synthetic") else None,
            "raizSintetica":current if current in funcs and funcs[current].get("synthetic") else None,
            "limite":"Origen localizado en el árbol; no acredita disparo efectivo ni éxito de la acción"}
    ct[now]+=1
    related.append({**row,"estadoConsolidado":now,"evidenciaArbolActual":ev})
assert len(related)==989
# Cuatro llamadas históricas son subexpresiones o registros de un evento
# del nuevo AST; no son cuatro controles funcionales independientes.
by_aud={x["AUD"]:x for x in related}
absorbed={
 "AUD-00863":"AUD-00417",
 "AUD-00864":"AUD-00417",
 "AUD-00868":"AUD-00867",
 "AUD-00870":"AUD-00869",
}
for alias,parent in absorbed.items():
    row=by_aud[alias];target=by_aud[parent]
    assert row["estadoConsolidado"]=="origen_sin_correspondencia_unica_en_arbol_actual",alias
    evidence=target["evidenciaArbolActual"]
    assert evidence and evidence["nuevo"],(alias,parent)
    current=evidence["nuevo"]
    oldhandler=row["start"].get("handler") or ""
    if alias in ("AUD-00863","AUD-00864"):
        assert current.get("event")=="change"
        assert current.get("receiver")=="document.getElementById('alta-reclamo-ciudad')"
        assert oldhandler.startswith("document.getElementById('alta-reclamo-ciudad')")
    else:
        assert current.get("kind")=="startup_call"
        assert oldhandler in current.get("handler",""),alias
    row["estadoConsolidado"]="subexpresion_historica_asociada_al_registro_actual"
    row["evidenciaArbolActual"]={"AUDActual":parent,"accionVigente":current,
       "criterio":"subexpresión o registro histórico ligado a un evento actual único",
       "advertencia":"no contar como entrada funcional adicional ni arista nueva"}
# Los dos listeners incorporados en Paso 2 deben existir como entradas
# separadas en el árbol regenerado del código actual; verificar receptor y evento.
for aud,event in (("AUD-00988","input"),("AUD-00989","change")):
    row=by_aud[aud]
    matches=[t["action"] for t in tree["trees"] if t.get("action") and
      t["action"].get("file")=="plataforma/login.html" and
      t["action"].get("kind")=="listener" and
      t["action"].get("event")==event and
      t["action"].get("receiver")=="document.getElementById('alta-reclamo-buscar155')"]
    assert len(matches)==1,(aud,event,len(matches))
    current=matches[0];entry=current.get("entry")
    now=("nuevo_evento_con_funcion_AST_concreta" if entry in funcs and
         not funcs[entry].get("synthetic") else "nuevo_evento_con_receptor_arbol_sin_funcion_individual")
    row["estadoConsolidado"]=now
    row["evidenciaArbolActual"]={"accionVigente":current,
       "funcionAST":entry if now=="nuevo_evento_con_funcion_AST_concreta" else None,
       "criterio":"evento, receptor y origen únicos en árbol AST actual",
       "limite":"No certifica ejecución en navegador ni consumo de red"}
ct=collections.Counter(r["estadoConsolidado"] for r in related)
assert len(absorbed)==4

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
