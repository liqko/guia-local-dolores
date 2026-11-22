#!/usr/bin/env python3
"""Paso 3: remontar invocaciones de los 39 casos prioritarios hasta bloqueos verificables.
No crea aristas por coincidencias nominales ni considera `padre` como llamada.
"""
import collections,json,re
from pathlib import Path
tmp=Path("auditorias/temporal")
d=json.loads((tmp/"DICTAMEN_INDEPENDIENTE_155.json").read_text())
tree=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
grafo=json.loads((tmp/"GRAFO_COMPLETO_1691.json").read_text())
f={v["id"]:v for v in tree["functionGraph"]}
states={v["idAST"]:v["estado"] for v in grafo["funciones"]}
reverse=collections.defaultdict(set)
for fn in f.values():
    for call in fn.get("calls") or []:
        if call.get("to") in f:reverse[call["to"]].add(fn["id"])
rows=d["casos"]
priority=[r for r in rows if r["causaASTComprobada"].startswith(("invocacion_AST_local_existente","padre_fuera_de_saldo"))]
assert len(priority)==39
no_link={x["idAST"] for x in rows}
assert len(no_link)==155
out=[]
for r in priority:
    fid=r["idAST"]
    parent=r["padreAST"]
    if r["causaASTComprobada"].startswith("padre_fuera_de_saldo"):
        assert parent in f and parent not in no_link
        out.append({"idAST":fid,"grupo":"hijo_de_padre_fuera_del_saldo",
                    "padre":parent,"estadoPadre":states.get(parent,"fuera_del_subconjunto_1691"),
                    "llamadaASTAlHijo":bool(reverse.get(fid)),
                    "observacion":"padre fuera del saldo no constituye invocacion del hijo"})
        continue
    assert reverse.get(fid),fid
    frontier=[(fid,[fid])];visits=set();terminals=[]
    while frontier:
        node,path=frontier.pop()
        if node in visits:continue
        visits.add(node)
        callers=sorted(reverse.get(node,set()))
        if not callers:
            terminals.append({"idAST":node,"nombre":f[node]["name"],
              "estadoEnGrafo":states.get(node,"fuera_del_subconjunto_1691"),
              "longitudCamino":len(path),"caminoHaciaHijo":list(reversed(path))})
        else:
            for src in callers:
                if src not in path:frontier.append((src,path+[src]))
        assert len(visits)<=len(f)
    out.append({"idAST":fid,"grupo":"invocador_local_bloqueado",
                "invocadores":sorted(reverse[fid]),"raicesASTSinInvocador":terminals,
                "nodosRecorridos":len(visits),
                "observacion":"reconstruccion inversa sobre AST; sin aristas externas o dinamicas inferidas"})
assert len(out)==39
roots=collections.Counter(t["idAST"] for r in out for t in r.get("raicesASTSinInvocador",[]))
parents=collections.Counter(r["estadoPadre"] for r in out if "estadoPadre" in r)
assert sum(v["grupo"]=="invocador_local_bloqueado" for v in out)==15
assert sum(v["grupo"]=="hijo_de_padre_fuera_del_saldo" for v in out)==24
result={"identidades":39,"llamadasLocalesConRaizBloqueante":15,
    "hijosDePadresFueraDelSaldo":24,"raicesDistintas":len(roots),
    "raicesAST":dict(sorted(roots.items())),
    "estadosDePadres":dict(sorted(parents.items())),
    "aristasNuevas":0,"saldoSinEntrada":155,
    "limitacion":"No prueba invocacion externa, carga del script ni condicion dinamica",
    "detalle":out}
(tmp/"CADENAS_PRIORITARIAS_39.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print("PASO3_39_CADENAS",json.dumps({k:v for k,v in result.items() if k!="detalle"},ensure_ascii=False))
