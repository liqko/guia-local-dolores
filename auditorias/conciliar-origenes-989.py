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
assert len(pending)==166,len(pending)
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
output={"summary":{"pending":len(results),
 "startupExact":sum(bool(r["startupMatchExact"]) for r in results),
 "startupSameLine":sum(bool(r["startupMatchSameLine"]) for r in results)},
 "cases":results}
Path("auditorias/temporal/CONCILIACION_ORIGENES_166.json").write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
