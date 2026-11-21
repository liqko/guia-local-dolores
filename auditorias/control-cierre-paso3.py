#!/usr/bin/env python3
"""Paso 3: control de cierre verificable, por identidad AST, sin descuentos por nombre."""
import collections
import json
from pathlib import Path

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
