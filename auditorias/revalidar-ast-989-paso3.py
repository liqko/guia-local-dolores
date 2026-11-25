#!/usr/bin/env python3
"""Revalidación AST del Paso 3 sobre código nuevo, sin aplicar identidades obsoletas."""
import collections,json
from pathlib import Path
old=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
new=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
g=json.loads(Path("auditorias/temporal/GRAFO_COMPLETO_1691.json").read_text())
a=old["sourceHashes"];b=new["sourceHashes"]
common=set(a)&set(b)
modified=sorted(p for p in common if a[p]!=b[p])
removed=sorted(set(a)-set(b))
added=sorted(set(b)-set(a))
O={f["id"]:f for f in old["functionGraph"]}
N={f["id"]:f for f in new["functionGraph"]}
assert len(g["funciones"])==1691
safe=[];affected=[];missing=[];not_safe=[]
for rec in g["funciones"]:
    fid=rec["idAST"]
    assert fid in O,fid
    src=O[fid]["file"]
    if src in common and a[src]==b[src]:
        assert fid in N,("AST sin identidad en archivo inalterado",fid)
        safe.append({"idAST":fid,"estadoAnterior":rec["estado"],"archivo":src})
    else:
        affected.append({"idAST":fid,"estadoAnterior":rec["estado"],"archivo":src,"discrepancia":"fuente_distinta_o_ausente_no_remapear_por_nombre"})
p=Path("auditorias/temporal/REVALIDACION_AST_CORTE_989.json")
res={"cortes":{"historico":"e6362836e6078a14a361732d79a8212258934056","nuevo":"9b7fd659e3b9f46e4a714955016df26ce3764c82"},
 "fuentesComunes":len(common),"fuentesModificadas":modified,"fuentesNuevas":added,"fuentesAusentes":removed,
 "funcionesASTTotalHistorico":len(old["functionGraph"]),"funcionesASTTotalActual":len(new["functionGraph"]),
 "subconjuntoHistórico":1691,"identidadesConFuenteInalterada":len(safe),
 "identidadesQueExigenRemapeo":len(affected),
 "sinEnlaceHistoricasEnFuentesInalteradas":sum(r["estadoAnterior"]=="falta_enlace_a_entrada" for r in safe),
 "sinEnlaceHistoricasEnFuentesModificadas":sum(r["estadoAnterior"]=="falta_enlace_a_entrada" for r in affected),
 "saldoActualSinEnlace":None,
 "riesgo":"No extrapolar 155 de e636 a 9b ni equiparar AST por coincidencia nominal",
 "identidadesSinCambio":safe,"identidadesARevalidar":affected}
assert len(safe)+len(affected)==1691
p.write_text(json.dumps(res,ensure_ascii=False,indent=2)+"\n")
print("PASO3_REVALIDACION_AST_989",json.dumps({k:v for k,v in res.items() if k not in ("identidadesSinCambio","identidadesARevalidar")},ensure_ascii=False))
