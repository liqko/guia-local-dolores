#!/usr/bin/env python3
"""Paso 3: inspección de entradas startup y listeners con receptor real, sin renumerar."""
import json,collections
from pathlib import Path
model=json.loads(Path("auditorias/temporal/MODELO_COBERTURA_989.json").read_text())
new=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
old=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
pending=[r for r in model["acciones"] if r["estado"] in (
 "origen_de_fuente_modificada_sin_remapeo",
 "origen_sintetico_o_externo_sin_binding_AST_confirmado",
 "origen_no_reconstruido_en_AST")]
assert 0<len(pending)<=166, ('Conciliación incremental del corte anterior',len(pending))
startup=new.get("startupCalls") or []
def norm(s):return "".join(str(s or "").split())
def same_file(a,b):return a.get("file")==b.get("file")
def matches_start(r):
 s=r["start"]; handler=norm(s.get("handler"))
 candidates=[x for x in startup if same_file(x,s) and norm(x.get("expression"))==handler]
 near=[x for x in startup if same_file(x,s) and x.get("line")==s.get("line")]
 return candidates,near
print("PASO3_AUDIT_STRUCTURE",json.dumps({"treeCount":len(new.get("trees",[])),
 "treeExample":new.get("trees",[{}])[0],
 "startupCount":len(startup),"startupExample":startup[:3]},ensure_ascii=False)[:4000])
group=collections.defaultdict(list)
for r in pending:
 kind=r["start"].get("kind")
 group[(r["estado"],kind)].append(r)
print("PASO3_PENDIENTES_166_TIPOS",json.dumps({str(k):len(v) for k,v in group.items()},ensure_ascii=False))
results=[]
for r in pending:
 s=r["start"]; exact,near=matches_start(r)
 results.append({"AUD":r["AUD"],"state":r["estado"],"kind":s.get("kind"),
 "start":s,"startupMatchExact":len(exact),
 "startupMatchSameLine":len(near),"startupExactEvidence":exact[:3],
 "startupNearEvidence":near[:3]})
print("PASO3_STARTUP_EVIDENCIA",json.dumps({
 "exact":sum(bool(r["startupMatchExact"]) for r in results),
 "sameLine":sum(bool(r["startupMatchSameLine"]) for r in results),
 "byKind":dict(collections.Counter(r["kind"] for r in results)),
 "examples":results[:8]},ensure_ascii=False)[:5200])
for r in results:
 if r["state"]=="origen_de_fuente_modificada_sin_remapeo":
  print("PASO3_MODIFICADO_30",json.dumps({
    "AUD":r["AUD"],"kind":r["kind"],"handler":r["start"].get("handler"),
    "event":r["start"].get("event"),"receiver":r["start"].get("receiver"),
    "line":r["start"].get("line"),"startupExact":r["startupMatchExact"],
    "startupSameLine":r["startupMatchSameLine"]},ensure_ascii=False)[:1300])

# El árbol nuevo contiene nodos 'action' para inicializaciones y eventos
# sin una función AST propia. Para ellos la ausencia de binding a functionGraph
# NO es ausencia de un disparador; cotejar por ID de origen y receptor.
newactions=[t["action"] for t in new["trees"] if t.get("action")]
action_by_id=collections.defaultdict(list)
for act in newactions:action_by_id[act.get("id")].append(act)
def source_match(row):
  src=row["start"]
  same=action_by_id.get(src.get("id"),[])
  if len(same)==1 and same[0].get("file")==src.get("file") and same[0].get("kind")==src.get("kind"):
      return "id_origen_exacto_en_arbol_actual",same[0]
  candidates=[act for act in newactions if act.get("file")==src.get("file") and act.get("kind")==src.get("kind")]
  if src.get("kind")=="listener":
      candidates=[act for act in candidates if act.get("event")==src.get("event") and act.get("receiver")==src.get("receiver")]
  elif src.get("kind")=="startup_call":
      h=(src.get("handler") or "").strip()
      candidates=[act for act in candidates if h and (act.get("handler") or "").strip().startswith(h)]
  elif src.get("kind")=="event_property":
      candidates=[act for act in candidates if act.get("event")==src.get("event") and act.get("receiver")==src.get("receiver")]
  elif src.get("kind") in ("html_handler","generated_markup"):
      candidates=[act for act in candidates if act.get("handler")==src.get("handler") and act.get("element")==src.get("element")]
  if len(candidates)==1:return "descriptor_unico_en_arbol_actual",candidates[0]
  return "sin_correspondencia_unica",None
matchcounts=collections.Counter()
for row in results:
  category,act=source_match(row)
  row["correspondenciaArbol"]=category
  row["receptorArbol"]=act
  matchcounts[(row["state"],category)]+=1
print("PASO3_166_CORRESPONDENCIAS_ARBOL",json.dumps({str(k):v for k,v in matchcounts.items()},ensure_ascii=False))
for row in results:
  if row["state"]=="origen_de_fuente_modificada_sin_remapeo":
    print("PASO3_30_CORRESPONDENCIAS",json.dumps({
       "AUD":row["AUD"],"tipo":row["kind"],"estado":row["correspondenciaArbol"],
       "receptor":row["receptorArbol"]},ensure_ascii=False)[:1100])

output={"summary":{"universoHistoricoConciliado":166,"pending":len(results),
 "startupExact":sum(bool(r["startupMatchExact"]) for r in results),
 "startupSameLine":sum(bool(r["startupMatchSameLine"]) for r in results),
 "correspondenciasArbol":dict((str(k),v) for k,v in matchcounts.items())},
 "cases":results}
Path("auditorias/temporal/CONCILIACION_ORIGENES_166.json").write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
