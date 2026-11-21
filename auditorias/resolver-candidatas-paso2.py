#!/usr/bin/env python3
"""Paso 2: resolver sólo rutas literales administrativas con receptor y método acreditados.

No modifica plataforma/ ni worker/. Modifica el ZIP del catálogo existente y
conserva IDs, historial, grupos externos y asociaciones no revisadas.
"""
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "auditorias/transversal/CATALOGO_MAESTRO.zip"
ADMIN = ROOT / "plataforma/administracion.html"
WORKER = ROOT / "worker/worker206.txt"

# Línea de invocación, sufijo que recibe ghAdminRequest_, verbo y manejador Worker.
ROUTES = {
    971: ("/moderators", "GET", "routeModeratorsV72"),
    3788: ("/commercial/personnel", "GET", "rolesInternosRoute188"),
    3465: ("/sales/contracts/close", "POST", "gldCerrarContrato185"),
    3418: ("/catalogs/prices", "POST", "gldRutaPreciosAdmin162"),
    2863: ("/catalogs/functional-settings", "POST", "gldFuncEndpoint166"),
    1032: ("/support/conversation", "GET", "routeSupportV73"),
    1034: ("/support/reply", "POST", "routeSupportV73"),
    1042: ("/support/resolve", "POST", "routeSupportV73"),
    1046: ("/support/resolve", "POST", "routeSupportV73"),
    1906: ("/free-event-exceptions", "GET", "routeModeratorsV72"),
    1913: ("/free-event-exceptions", "POST", "routeModeratorsV72"),
}

# Llamadas directas fetch: línea, destino absoluto conocido, verbo y handler.
DIRECT = {
    1146: ("/superadmin/moderation/resolve", "POST", "routeAdminV3"),
    1561: ("/superadmin/cities/create", "POST", "routeAdminV3"),
    4008: ("/superadmin/publications/recent", "POST", "routePublicationsV77"),
    1055: ("/superadmin/session/login", "POST", "routeAdminV10"),
    1079: ("/superadmin/dashboard", "GET", "routeAdminV10"),
}

def source_line(lines, n, suffix, method):
    line = lines[n - 1]
    if not re.search(r"ghAdminRequest_\(\s*['\"]" + re.escape(suffix), line):
        raise ValueError(f"Site {n} no longer calls {suffix}")
    if method == "POST" and not re.search(r",\s*['\"]POST['\"]\s*\)", line):
        raise ValueError(f"POST guard changed at {n}")
    if method == "GET" and re.search(r",\s*['\"]POST['\"]\s*\)", line):
        raise ValueError(f"GET site became POST at {n}")

def main():
    admin = ADMIN.read_text(encoding="utf-8")
    worker = WORKER.read_text(encoding="utf-8")
    assert "const API='https://login.liqkoargentina.workers.dev/superadmin'" in admin
    assert "let url=API+path;" in admin
    assert "async function ghAdminRequest_(path,data={},method='GET')" in admin
    lines = admin.splitlines()
    for line, (suffix, method, handler) in ROUTES.items():
        source_line(lines, line, suffix, method)
        if "/superadmin" + suffix not in worker:
            raise ValueError(f"No Worker literal for {suffix}")
        if handler not in worker:
            raise ValueError(f"No Worker handler {handler}")

    with zipfile.ZipFile(ARCHIVE, "r") as src:
        infos = src.infolist()
        if [x.filename for x in infos] != ["CATALOGO_MAESTRO.json"]:
            raise ValueError("Unexpected archive members")
        raw = src.read(infos[0].filename)
    catalog = json.loads(raw)
    entries = catalog["entries"]
    ids_before = [x["id"] for x in entries]
    if len(ids_before) != 989 or len(set(ids_before)) != 989:
        raise ValueError("Unexpected catalog identity set")

    initial_pending = sum(
        n.get("routeStatus") == "backend_candidate"
        for e in entries for n in e.get("network", [])
    )
    changed, touched = 0, set()
    evidence = []
    for entry in entries:
        for network in entry.get("network", []):
            if network.get("routeStatus") != "backend_candidate":
                continue
            if network.get("file") != "plataforma/administracion.html":
                continue
            line = network.get("line")
            if line not in ROUTES:
                continue
            suffix, method, handler = ROUTES[line]
            route = "/superadmin" + suffix
            possible = network.get("candidates") or []
            if route not in possible:
                continue
            old = {
                "routeStatus": network.get("routeStatus"),
                "target": network.get("target"),
                "verb": network.get("verb"),
                "candidates": possible[:],
                "worker": network.get("worker", [])[:],
            }
            network["routeStatus"] = "comprobada_condicional"
            network["target"] = route
            network["verb"] = method
            network["candidates"] = [route]
            network["worker"] = [{
                "file": "worker/worker206.txt",
                "handler": handler,
                "evidencia": "ghAdminRequest_ con API=/superadmin, ruta literal y método comprobados en fuente; autorización y estado condicionan ejecución",
            }]
            network.setdefault("cotejoPaso2Original", old)
            note = {
                "sitio": network.get("callId"),
                "decision": "comprobada_condicional",
                "metodo": method,
                "ruta": route,
                "origen": "plataforma/administracion.html:" + str(line),
                "workerHandler": handler,
                "condiciones": "Exige ruta despachada, sesión y permisos; cotejo estático, no ejecución real.",
            }
            cotejo = entry.setdefault("cotejoPaso2", {})
            seen = cotejo.setdefault("conexiones", [])
            if not any(c.get("sitio") == note["sitio"] and c.get("ruta") == route for c in seen):
                seen.append(note)
            changed += 1
            touched.add(entry["id"])
            evidence.append((entry["id"], line, method, route))

    # El camino directo conserva el URL físico y la guarda de método explícita.
    for line, (route, method, handler) in DIRECT.items():
        text = lines[line - 1]
        if "fetch(TERRITORY_API_ORIGIN+'"+route+"'" not in text:
            raise ValueError(f"Direct fetch changed at line {line}")
        if method == "POST":
            around = "\\n".join(lines[line - 1:line + 4])
            if "method:'POST'" not in around:
                raise ValueError(f"Direct POST changed at line {line}")
        elif "method:'POST'" in text:
            raise ValueError(f"Direct GET changed at line {line}")
        if route not in worker:
            raise ValueError(f"No Worker route {route}")
        if handler not in worker:
            raise ValueError(f"No Worker handler {handler}")
        for entry in entries:
            for network in entry.get("network", []):
                if network.get("routeStatus") != "backend_candidate":
                    continue
                if network.get("file") != "plataforma/administracion.html" or network.get("line") != line:
                    continue
                if route not in (network.get("candidates") or []):
                    continue
                original = {
                    "routeStatus": network.get("routeStatus"),
                    "target": network.get("target"),
                    "verb": network.get("verb"),
                    "candidates": (network.get("candidates") or [])[:],
                    "worker": network.get("worker", [])[:],
                }
                network["routeStatus"] = "comprobada_condicional"
                network["target"] = route
                network["verb"] = method
                network["candidates"] = [route]
                network["worker"] = [{
                    "file": "worker/worker206.txt", "handler": handler,
                    "evidencia": "fetch directo, URL, verbo y ruta en Worker cotejados; ejecución sujeta a condiciones de interfaz y permisos",
                }]
                network.setdefault("cotejoPaso2Original", original)
                cotejo = entry.setdefault("cotejoPaso2", {})
                note = {
                    "sitio": network.get("callId"),
                    "decision": "comprobada_condicional",
                    "metodo": method,
                    "ruta": route,
                    "origen": "plataforma/administracion.html:" + str(line),
                    "workerHandler": handler,
                    "condiciones": "Ruta y método verificados en fuente, sin prueba de ejecución real.",
                }
                existing = cotejo.setdefault("conexiones", [])
                if not any(n.get("sitio") == note["sitio"] and n.get("ruta") == route for n in existing):
                    existing.append(note)
                changed += 1
                touched.add(entry["id"])
                evidence.append((entry["id"], line, method, route))

    if not changed:
        grouped = {}
        for unit in entries:
            for n in unit.get("network", []):
                if n.get("routeStatus") == "backend_candidate":
                    key = (n.get("file"), n.get("line"), n.get("callId"))
                    g = grouped.setdefault(key, {"file": key[0], "line": key[1], "ids": [], "targets": [], "candidates": []})
                    g["ids"].append(unit["id"])
                    if n.get("target") not in g["targets"]:
                        g["targets"].append(n.get("target"))
                    for c in n.get("candidates") or []:
                        if c not in g["candidates"]:
                            g["candidates"].append(c)
        print(json.dumps({"changed": 0, "pending": initial_pending, "groups": len(grouped)}, ensure_ascii=False))
        for n, item in enumerate(grouped.values()):
            print("PASO2_RESTANTE", n, json.dumps(item, ensure_ascii=False))
        return
    if [x["id"] for x in entries] != ids_before:
        raise ValueError("IDs changed")
    state_counts = {}
    for entry in entries:
        for n in entry.get("network", []):
            k = n.get("routeStatus")
            state_counts[k] = state_counts.get(k, 0) + 1
    if state_counts.get("backend_candidate", 0) != initial_pending - changed:
        raise ValueError(f"Unexpected residual: {state_counts}")
    meta = catalog.setdefault("cotejoPaso2", {})
    meta.setdefault("gruposDestinosGenericos", []).append({
        "grupo": "Rutas literales de Administración y soporte: receptor ghAdminRequest_",
        "revisadas": changed,
        "comprobadas": changed,
        "descartadas": 0,
        "unidades": len(touched),
        "pendientesGenericas": state_counts["backend_candidate"],
        "evidencia": "Llamador literal y verbo en administracion.html, prefijo API y ruta en worker206.txt",
        "alcance": "Sólo asociación estática condicionada; no afirma permisos ni ejecución real",
    })
    output = json.dumps(catalog, ensure_ascii=False, indent=2).encode("utf-8")
    if not sys.argv[1:] or sys.argv[1] != "--write":
        print(json.dumps({"changed": changed, "units": len(touched), "pending": state_counts["backend_candidate"],
                          "routes": sorted(set(x[3] for x in evidence)), "evidence": evidence}, ensure_ascii=False))
        return

    image = io.BytesIO()
    with zipfile.ZipFile(image, "w") as dest:
        dest.writestr(infos[0], output)
    fd, temp = tempfile.mkstemp(prefix="catalogo-paso2-", suffix=".zip", dir=ARCHIVE.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(image.getvalue())
        with zipfile.ZipFile(temp) as check:
            updated = json.loads(check.read("CATALOGO_MAESTRO.json"))
        assert [a["id"] for a in updated["entries"]] == ids_before
        os.replace(temp, ARCHIVE)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    print(json.dumps({"changed": changed, "units": len(touched), "pending": state_counts["backend_candidate"],
                      "routes": sorted(set(x[3] for x in evidence)), "evidence": evidence}, ensure_ascii=False))

if __name__ == "__main__":
    main()
