#!/usr/bin/env python3
"""Cotejo Paso 3 con cierre de Paso 2. No equipara catálogos con un simple recuento."""
import collections, hashlib, json, re, zipfile
from pathlib import Path
OUT=Path("auditorias/temporal");OUT.mkdir(parents=True,exist_ok=True)
def readzip(p):
    with zipfile.ZipFile(p) as z:return json.loads(z.read("CATALOGO_MAESTRO.json"))
old=readzip("auditorias/transversal/CATALOGO_MAESTRO.zip")
new=readzip("paso2/auditorias/transversal/CATALOGO_MAESTRO.zip")
assert len(old["entries"])==987, len(old["entries"])
assert len(new["entries"])==989, len(new["entries"])
def indexed(rows):
    d={r["id"]:r for r in rows}
    assert len(d)==len(rows),"IDs duplicados"
    return d
a=indexed(old["entries"]);b=indexed(new["entries"])
assert sorted(b)==[f"AUD-{i:05d}" for i in range(1,990)]
assert set(b)-set(a)=={"AUD-00988","AUD-00989"}
assert not set(a)-set(b)
fields=("key","interface","start","status","mapStatus","counts","limitations","files","network","data","functions")
changed=[]
for k in sorted(a):
    diff=[key for key in fields if a[k].get(key)!=b[k].get(key)]
    if not diff and a[k]!=b[k]:diff=["otros_campos"]
    if diff:
        changed.append({"AUD":k,"camposModificados":diff,
            "origenAnterior":a[k].get("start"),
            "origenDefinitivo":b[k].get("start"),
            "redAnterior":a[k].get("network"),"redDefinitiva":b[k].get("network"),
            "functionsAnterior":a[k].get("functions"),"functionsDefinitiva":b[k].get("functions")})
shold=old.get("baseline",{}).get("sourceHashes",{})
shnew=new.get("baseline",{}).get("sourceHashes",{})
common=set(shold)&set(shnew)
hashchanged=sorted(x for x in common if shold[x]!=shnew[x])
for aid in ("AUD-00395","AUD-00865","AUD-00988","AUD-00989"):
    e=b[aid]
    print("PASO3_RECLAMOS_ID",json.dumps({"AUD":aid,"start":e.get("start"),
      "network":e.get("network"),"files":e.get("files"),
      "counts":e.get("counts")},ensure_ascii=False)[:3500])
# Verificar presencia exacta de oyentes nuevos y reemplazo del Enter en la revisión certificada.
current=Path("nuevo/plataforma/login.html").read_text()
historic=Path("baseline/plataforma/login.html").read_text()
assert "addEventListener('input'" in current and "alta-reclamo-buscar155" in current
assert "addEventListener('change',gldClaimResolveChoice155_)" in current
assert "addEventListener('keydown',event=>" in historic
assert "claimSearchTimer155=setTimeout(()=>buscarAnuncioReclamo155(),250)" in current
assert "/advertisers/claim-options?q=" in current
assert "gldClaimCityMatches155_" in current
# Afirmar sólo ausencia del receptor histórico sobre el control de reclamos, no de TODO keydown.
assert not re.search(r"getElementById\('alta-reclamo-buscar155'\)\?\.addEventListener\('keydown'",current)
new_actions={}
for aid in ("AUD-00988","AUD-00989"):
    e=b[aid]
    start=e.get("start") or {}
    new_actions[aid]={"archivo":start.get("file"),"linea":start.get("line"),
      "evento":start.get("event"),"elemento":start.get("elementId"),
      "handler":start.get("handler"),"origen":start,
      "redCandidata":e.get("network"),
      "limite":"entrada declarada en catálogo, ejecución DOM y respuesta Worker no medidas"}
    assert start.get("file")=="plataforma/login.html"
# Cruce fuente por sha únicamente, no igualar identidades AST de revisiones distintas.
summary={
  "catalogoHistorico":len(a),"catalogoDefinitivo":len(b),
  "identificadoresConservados":len(set(a)&set(b)),
  "identificadoresNuevos":sorted(set(b)-set(a)),
  "identificadoresPreviosConDiferenciasEstructurales":len(changed),
  "idsPreviosConDiferencias":[x["AUD"] for x in changed],
  "hashesComunes":len(common),"fuentesConHashDistinto":hashchanged,
  "fuentesNuevas":sorted(set(shnew)-set(shold)),
  "fuentesAusentes":sorted(set(shold)-set(shnew)),
  "casosReclamos":new_actions,
  "saldo155":"HISTORICO: solo corte e6362836; NO es saldo actual de 989",
  "funcionesSinEnlaceActual":None,
  "nivelDeAcreditacion":"diferencias de catálogo y puntos de origen; no recorrido funcional completo"}
report={"resumen":summary,"diferenciasAcciones":changed,
        "accionesNuevas":[b[k] for k in sorted(set(b)-set(a))],
        "cortes":{"historico":old.get("baseline"),"definitivo":new.get("baseline")}}
(OUT/"COMPATIBILIDAD_989_PASO3.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("PASO3_COMPATIBILIDAD_989",json.dumps({k:v for k,v in summary.items() if k not in ("casosReclamos","idsPreviosConDiferencias")},ensure_ascii=False))
print("PASO3_ID_CAMBIADOS",json.dumps(summary["idsPreviosConDiferencias"]))
