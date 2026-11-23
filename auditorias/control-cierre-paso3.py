#!/usr/bin/env python3
"""Paso 3: control de cierre verificable, por identidad AST, sin descuentos por nombre."""
import collections
import json
from pathlib import Path
import re

path=Path("auditorias/temporal/GRAFO_COMPLETO_1691.json")
grafo=json.loads(path.read_text())
filas=grafo["funciones"]
assert len(filas)==1691, f"Esperadas 1691 identidades; hay {len(filas)}"
ids=[f["idAST"] for f in filas]
assert len(set(ids))==1691, "Identidades AST duplicadas"
faltantes=[f for f in filas if f["estado"]=="falta_enlace_a_entrada"]
assert len(faltantes)==155, f"Cambio de saldo: {len(faltantes)}, revisar antes de actualizar control"
por_fuente=collections.Counter(f["idAST"].split(":")[0] for f in faltantes)
por_evaluacion=collections.Counter(f.get("evaluacionFuente") or "sin_evaluacion_especifica" for f in faltantes)
evidencia=[]
for f in faltantes:
    evaluacion=f.get("evaluacionFuente") or "sin_evaluacion_especifica"
    evidencia.append({
        "idAST":f["idAST"],
        "estadoConexion":"falta_enlace_a_entrada",
        "evaluacionFuente":evaluacion,
        "clasificacionCausalDisponible":evaluacion!="sin_evaluacion_especifica",
        "pruebaRequerida":"demostrar una cadena de activacion desde entrada AUD, o declarar excepcion historica con evidencia de fuente, alcance y receptor; no convertir coincidencias nominales en aristas"
    })

# Cotejo documental independiente de las evaluaciones producidas por el
# reconstructor. Lee el AST original y la fuente, no infiere llamadas por nombres.
tree=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
funciones={f["id"]:f for f in tree["functionGraph"]}
assert len(funciones)==len(tree["functionGraph"])
reverse=collections.defaultdict(set)
for function in funciones.values():
    for call in function.get("calls") or []:
        dst=call.get("to")
        if dst in funciones:reverse[dst].add(function["id"])
restantes={r["idAST"] for r in faltantes}
dictamenes=[]
for f in faltantes:
    fid=f["idAST"]
    assert fid in funciones, ("identidad ausente del AST",fid)
    fn=funciones[fid]
    archivo=fn["file"]
    lineas=Path("baseline",archivo).read_text().splitlines()
    linea=fn["line"]
    assert 1<=linea<=len(lineas)
    padre=fn.get("parent")
    invocadores=sorted(reverse.get(fid,set()))
    nominal=fn.get("name") or ""
    # Coincidencia solo nominal y dentro de la MISMA fuente; se registra
    # únicamente como evidencia léxica, nunca como arista.
    if nominal.isidentifier() and len(nominal)>=3:
        patron=re.compile(r"(?<![A-Za-z0-9_$])"+re.escape(nominal)+r"(?![A-Za-z0-9_$])")
        ocurrencias=[n for n,texto in enumerate(lineas,1) if patron.search(texto)]
    else:
        ocurrencias=[]
    if padre in funciones and padre not in restantes:
        causa="padre_fuera_de_saldo_sin_activacion_de_hijo_acreditada"
    elif invocadores:
        causa="invocacion_AST_local_existente_sin_recorrido_AUD"
    elif padre in funciones:
        causa="declaracion_anidada_sin_invocador_AST_acreditado"
    else:
        causa="declaracion_sin_invocador_AST_acreditado"
    if not invocadores and ocurrencias==[linea]:
        causa+="_y_unica_referencia_nominal_en_fuente"
    dictamenes.append({
        "idAST":fid,"archivo":archivo,"linea":linea,
        "nombre":nominal,"padreAST":padre,"invocadoresAST":invocadores,
        "sitiosNominalesMismoArchivo":ocurrencias[:30],
        "cantidadSitiosNominales":len(ocurrencias),
        "fragmentoFuente":lineas[linea-1].strip()[:240],
        "causaASTComprobada":causa,
        "evaluacionPrevia":f.get("evaluacionFuente") or None,
        "limite":"Diagnostico estatico; no implica ejecucion o desuso"
    })
assert len(dictamenes)==155 and len({r["idAST"] for r in dictamenes})==155
assert set(r["idAST"] for r in dictamenes)==restantes
por_causa=collections.Counter(r["causaASTComprobada"] for r in dictamenes)
sin_previa=[r for r in dictamenes if not r["evaluacionPrevia"]]
assert len(sin_previa)==63, f"Cambio en evaluaciones previas: {len(sin_previa)}"
complemento={
    "nodosConEvidenciaDeFuenteIndividual":len(dictamenes),
    "nodosSinEvaluacionPreviaConEvidenciaAST":len(sin_previa),
    "clasificacionPorCausa":dict(sorted(por_causa.items())),
    "fronteraPendiente":"155 sin recorrido acreditado a AUD; se requiere investigar activaciones dinamicas/externas y excepciones historicas",
    "casos":dictamenes
}
ruta_complemento=Path("auditorias/temporal/DICTAMEN_INDEPENDIENTE_155.json")
ruta_complemento.write_text(json.dumps(complemento,ensure_ascii=False,indent=2)+"\n")
print("PASO3_DICTAMEN_INDEPENDIENTE",json.dumps({
    "total":len(dictamenes),"evaluacionesPreviasAusentesCotejadas":len(sin_previa),
    "porCausa":dict(sorted(por_causa.items())),
    "aristasRecuperadas":0,"funcionesAunSinEntrada":155
},ensure_ascii=False))
# Prioridad inmediata: 15 invocadores locales y 24 hijos cuyo padre no está en el saldo.
prioritarios=[r for r in dictamenes if r["causaASTComprobada"].startswith(("invocacion_AST_local_existente","padre_fuera_de_saldo"))]
assert len(prioritarios)==39, len(prioritarios)
for item in prioritarios:
    print("PASO3_PRIORITARIO_39",json.dumps({k:item[k] for k in ("idAST","nombre","padreAST","invocadoresAST","fragmentoFuente","causaASTComprobada")},ensure_ascii=False))
sin_evaluacion=[f["idAST"] for f in evidencia if not f["clasificacionCausalDisponible"]]
resultado={
    "corte":"e6362836e6078a14a361732d79a8212258934056",
    "totalIdentidades":1691,
    "faltantesEnlace":len(faltantes),
    "porArchivo":dict(sorted(por_fuente.items())),
    "evaluacionesFuente":dict(sorted(por_evaluacion.items())),
    "sinEvaluacionEspecifica":sin_evaluacion,
    "puedeCerrarPaso3":False,
    "razonNoCierre":"Las 155 funciones conservan estado falta_enlace_a_entrada; las clasificaciones causales no certifican recorrido accion-efecto. Falta revalidacion independiente 3.4.",
    "identidades":evidencia
}
salida=Path("auditorias/temporal/CONTROL_CIERRE_PASO3_155.json")
salida.write_text(json.dumps(resultado,ensure_ascii=False,indent=2)+"\n")
print("PASO3_CONTROL_CIERRE",json.dumps({k:v for k,v in resultado.items() if k!="identidades"},ensure_ascii=False))

# Validación independiente 3.4 del estado ACTUAL, sin sustituir el
# control histórico de 155 ni afirmar cierre a partir de sumas.
p_indirecta=Path("auditorias/temporal/REVALIDACION_INDIRECTA_1691_ACTUAL.json")
p_red=Path("auditorias/temporal/CONTRASTE_218_ASOCIACIONES_ACTUALES.json")
p_cruce=Path("auditorias/temporal/CRUCE_989_1691_ACTUAL.json")
a=json.loads(p_indirecta.read_text())
b=json.loads(p_red.read_text())
c=json.loads(p_cruce.read_text())
actual=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
func_actual={f["id"]:f for f in actual["functionGraph"]}
assert len(a["funciones"])==1691
assert len({f["idASTHistorico"] for f in a["funciones"]})==1691
assert all(f["clasificacionActual"] for f in a["funciones"])
assert len(b["acciones"])==218
assert len({x["AUD"] for x in b["acciones"]})==218
assert c["resumen"]["accionesVigentesSinArbolUnico"]==0
assert c["resumen"]["accionesVigentesConArbolIdentificado"]==980
assert len(c["pendientesRemapeo"])==sum(x["idASTActual"] is None for x in a["funciones"])
# Comprobar de manera independiente las aristas que se declaran válidas:
# si un par no existe en el AST vigente o en callbackBindings, rechazar.
callbacks=set()
for record in actual.get("callbackBindings",[]):
    src=record["binding"].split("|")[0]
    for dst in record["targets"]: callbacks.add((src,dst))
verified_chains=0
for row in a["funciones"]:
    chain=row.get("cadenaActualCandidata")
    edges=row.get("aristasActuales")
    if edges is None:continue
    assert chain is not None and len(edges)==len(chain)-1
    for src,dst,kind in zip(chain,chain[1:],edges):
        if kind=="llamada_AST_actual":
            assert any(call.get("to")==dst for call in func_actual[src].get("calls",[])),row["idASTHistorico"]
        elif kind=="callback_registrado_AST_actual_condicional":
            assert (src,dst) in callbacks,row["idASTHistorico"]
        else:
            assert kind=="arista_historica_no_correspondida_en_AST_actual"
    if row["clasificacionActual"].startswith("cadena_AST_revalidada"):
        assert "arista_historica_no_correspondida_en_AST_actual" not in edges
        verified_chains+=1
for row in b["acciones"]:
    for check in row["comprobaciones"]:
        if check["estado"]=="asociacion_estatica_identica_en_arbol_de_accion":
            assert not check["razones"]
        elif check["estado"]=="diferencia_de_contrato_o_destino":
            assert check["razones"]
        else:
            assert check["estado"]=="sin_callId_unico_en_arbol_vigente"
issues={
 "identidadesSinEquivalencia":sum(x["idASTActual"] is None for x in a["funciones"]),
 "cadenasSinRaizOReceptorConfirmado":sum(x["clasificacionActual"] in (
   "cadena_indirecta_con_identidad_intermedia_no_remapeada",
   "cadena_indirecta_requiere_verificacion_de_receptor",
   "cadena_AST_sin_raiz_de_AUD_acreditada",
   "cadena_AST_sin_AUD_vigente_acreditada",
   "cadena_AST_con_arranque_pendiente_de_confirmar") for x in a["funciones"]),
 "asociacionesDeRedSinConcordanciaEstatica":sum(
   check["estado"]!="asociacion_estatica_identica_en_arbol_de_accion"
   for row in b["acciones"] for check in row["comprobaciones"]),
 "sinConsumidorRevisadoSoloEnHistorico":sum(x["clasificacionActual"]==
   "sin_consumidor_acreditado_en_revision_historica" for x in a["funciones"])
}
report={
 "control":"Paso 3.4 independiente, código actualizado 9b7fd659",
 "integridad989":c["resumen"]["accionesVigentesConArbolIdentificado"]==980,
 "integridad1691":True,
 "integridad218":True,
 "cadenasASTRevalidadas":verified_chains,
 "impedimentosDeCertificacion":issues,
 "paso3Cerrado":False,
 "motivo":"Faltan pruebas de equivalencia, raíz o receptor, y concordancia de asociaciones antes del cierre; los dictámenes históricos no equivalen a prueba actual"
}
Path("auditorias/temporal/VALIDACION_INDEPENDIENTE_3_4_ACTUAL.json").write_text(
 json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("PASO3_VALIDACION_INDEPENDIENTE_3_4",json.dumps(report,ensure_ascii=False))
