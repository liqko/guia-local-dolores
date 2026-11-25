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
# Inventario final del Paso 1 incorporado sin alterar su fuente ni el catálogo.
inventario=json.loads(Path("paso2/auditorias/transversal/MAPA_DINAMICO_INVENTARIO_44210648484.json").read_text())
vig=inventario["verificacionVigente"]
assert len(inventario["entries"])==44
assert len(inventario["uncertain"])==15
assert len(vig["entradas"])==44
assert len(vig["construccionesEspeciales"])==15
assert len(vig["excepcionesVivo"])==7
ids_dinamicos=[v.get("AUD") for v in vig["entradas"]]
assert all(aud in defin for aud in ids_dinamicos),set(ids_dinamicos)-set(defin)
construcciones={k:v for k,v in vig["construccionesEspeciales"].items()}
construccion_ids=[a for v in construcciones.values() for a in v.get("AUD",[])]
assert all(aud in defin for aud in construccion_ids),set(construccion_ids)-set(defin)
cambio=vig["cambioReclamo"]
historicos={"AUD-00395","AUD-00418","AUD-00419"}
historicos.update(a for v in cambio["retiradas"] for a in v.get("registrosArranqueHistoricos",[]))
assert historicos=={"AUD-00395","AUD-00418","AUD-00419","AUD-00865","AUD-00866"}
assert all(a in defin for a in historicos)
assert {v["AUD"] for v in cambio["conservadas"]}=={"AUD-00417"}
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
    elif aud in historicos:
        state="control_historico_reemplazado_paso1"
        evidence="Inventario del Paso 1 identifica control anterior retirado; conservar AUD y su equivalencia, no atribuir activacion al código nuevo"
    elif entry in newFn and start.get("file") in unchanged:
        if newFn[entry].get("synthetic"):
            state="raiz_sintetica_en_fuente_inalterada"
            evidence="inicio sintético de acción en archivo con SHA256 idéntico: NO es función de JavaScript"
        else:
            state="origen_AST_en_fuente_inalterada"
            evidence="ID AST de función real persistente en archivo con SHA256 de fuente idéntico"
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
 "paso1DinamicasComprobadas":len(ids_dinamicos),
 "paso1ConstruccionesEspeciales":len(construcciones),
 "paso1ExcepcionesVivoConservadas":len(vig["excepcionesVivo"]),
 "historicosReemplazados":sorted(historicos),
 "audConservadaReclamos":"AUD-00417",
 "noEquivalencia": "No se convierte un origen en función alcanzable sin cadena de invocaciones y receptor",
 "saldoActualSinEnlace":None},
 "acciones":entries}
Path("auditorias/temporal/MODELO_COBERTURA_989.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
print("PASO3_ORIGENES_PENDIENTES",json.dumps([{k:e[k] for k in ("AUD","estado","start")} for e in entries if e["estado"] in ("origen_de_fuente_modificada_sin_remapeo","origen_sintetico_o_externo_sin_binding_AST_confirmado","origen_no_reconstruido_en_AST")],ensure_ascii=False))
print("PASO3_MODELO_989",json.dumps(out["summary"],ensure_ascii=False))
