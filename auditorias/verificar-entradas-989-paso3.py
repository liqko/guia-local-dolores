#!/usr/bin/env python3
"""Paso 3: conservar acciones 989 y distinguir origen AST, manual, o reemplazado."""
import collections,json,zipfile,re
from pathlib import Path
def cat(p):
    with zipfile.ZipFile(p) as z:return json.loads(z.read("CATALOGO_MAESTRO.json"))
a=cat("auditorias/transversal/CATALOGO_MAESTRO.zip")
b=cat("paso2/auditorias/transversal/CATALOGO_MAESTRO.zip")
old=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
new=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
remap=json.loads(Path("auditorias/temporal/REMAPPING_AST_989.json").read_text())
byOld={v["oldId"]:v for v in remap["ledger"]}
fullRemap=remap.get("fullMap",{})
newFn={f["id"]:f for f in new["functionGraph"]}
oldFn={f["id"]:f for f in old["functionGraph"]}
orig={e["id"]:e for e in a["entries"]}
defin={e["id"]:e for e in b["entries"]}
assert len(defin)==989 and len(orig)==987
src=Path("nuevo/plataforma/login.html").read_text()
assert "document.getElementById('alta-reclamo-buscar155')?.addEventListener('input'" in src
assert "document.getElementById('alta-reclamo-buscar155')?.addEventListener('change',gldClaimResolveChoice155_)" in src
assert not re.search(r"getElementById\('alta-reclamo-buscar155'\)\?\.addEventListener\('keydown'",src)
# Si una fuente no cambió, el mismo ID AST prueba correspondencia exacta.
unchanged={p for p,v in old["sourceHashes"].items() if new["sourceHashes"].get(p)==v}
entries=[];status=collections.Counter();changes=collections.Counter()
for aud in sorted(defin):
    row=defin[aud];start=row.get("start") or {};prev=orig.get(aud);entry=start.get("entry")
    diff=[]
    if prev:
        for k in sorted(set(prev)|set(row)):
            if prev.get(k)!=row.get(k):diff.append(k)
    for d in diff:changes[d]+=1
    if aud in ("AUD-00988","AUD-00989"):
        state="receptor_evento_nuevo_verificado_en_fuente"
        evidence="listener input / change en login.html, condicion GET solo al escribir"
    elif aud=="AUD-00865":
        state="origen_keydown_historico_reemplazado"
        evidence="keydown Enter del corte anterior ausente del login 9b; no etiquetar como listener vigente"
    elif aud=="AUD-00395":
        state="boton_historico_reemplazado_requiere_evaluar_equivalencia"
        evidence="origen html_handler del boton del corte e636; nueva busqueda input"
    elif entry in newFn and start.get("file") in unchanged:
        state="origen_AST_en_fuente_inalterada"
        evidence="ID AST persistente en archivo con SHA256 de fuente idéntico"
    elif entry in fullRemap and fullRemap[entry].get("newId"):
        state="origen_AST_remapeado_por_cuerpo"
        evidence=fullRemap[entry]["proof"]
    elif entry and start.get("file") in unchanged:
        state="origen_sintetico_o_externo_sin_binding_AST_confirmado"
        evidence="entrada declarada y fuente igual; no se localizó destino en functionGraph actual"
    elif entry and start.get("file") not in unchanged:
        state="origen_de_fuente_modificada_sin_remapeo"
        evidence="nodo viejo o sintético, requiere cotejo independiente en código 9b"
    else:
        state="origen_no_reconstruido_en_AST"
        evidence="no equivale a falla funcional; catalogado sin receptor exacto acreditado"
    status[state]+=1
    entries.append({"AUD":aud,"estado":state,"evidencia":evidence,
      "file":start.get("file"),"start":start,"differencesFromOld":diff,
      "candidatesNetwork":row.get("network"),"countFunctions":(row.get("counts") or {}).get("functions")})
assert len(entries)==989
assert set(x["AUD"] for x in entries)==set(defin)
out={"summary":{
 "accionesRegistradas":989,"accionesHistoricasRegistradas":987,"nuevas":2,
 "estados":dict(sorted(status.items())),
 "diferenciasPorCampo":dict(sorted(changes.items())),
 "accionesConCambios":sum(bool(v["differencesFromOld"]) for v in entries),
 "fuentesInalteradas":len(unchanged),
 "noEquivalencia": "No se convierte un origen en función alcanzable sin cadena de invocaciones y receptor",
 "saldoActualSinEnlace":None},
 "acciones":entries}
Path("auditorias/temporal/MODELO_COBERTURA_989.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print("PASO3_MODELO_989",json.dumps(out["summary"],ensure_ascii=False))
