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

# Sitios de lectura/escritura con URL explícita o constante local tipada.
# GET_POST distingue métodos genuinamente condicionados por body; no se fuerza un verbo único.
OTHERS = {
    "plataforma/suscriptores.html": {
        799: ("/suscriptores", "POST"), 825: ("/suscriptores", "GET"),
        1267: ("/suscriptores", "GET"), 1285: ("/suscriptores", "POST"),
        702: ("/suscriptores", "GET"), 1317: ("/suscriptores/territory", "GET"),
        1326: ("/suscriptores/territory", "POST"),
        1021: ("/suscriptores", "POST"), 1108: ("/suscriptores", "POST"),
        1078: ("/suscriptores/territory-schema", "GET"),
        1080: ("/suscriptores", "POST"), 1129: ("/suscriptores", "POST"),
        1169: ("/suscriptores", "POST"), 1214: ("/suscriptores", "POST"),
        1369: ("/suscriptores", "POST"),
    },
    "plataforma/carcasa.html": {
        1217: ("/suscriptores", "POST"), 1292: ("/suscriptores", "POST"),
        1332: ("/suscriptores", "POST"), 1573: ("/suscriptores", "POST"),
        1615: ("/suscriptores", "POST"),
    },
    "plataforma/anunciantes.html": {
        1428: ("/suscriptores", "POST"), 1390: ("/suscriptores", "GET"),
    },
    "plataforma/entrada-recordada.js": {28: ("/suscriptores", "GET")},
    "plataforma/terminos-anunciantes.js": {9: ("/advertiser/terms", "GET_POST")},
    "plataforma/farma_turnos.html": {
        383: ("/farmacias", "GET"), 384: ("/publicidad", "GET"),
    },
    "plataforma/promos.html": {1008: ("/promos", "GET")},
    "plataforma/administracion.html": {1392: ("/farmacias", "GET")},
}

# Referencias de línea pertenecen al corte original e6362836; se valida
# semánticamente cada función en el login vigente (líneas desplazadas por cambios).
LOGIN = {
    2158: ("buscarAnuncioReclamo155", "/advertisers/claim-options", "GET", "fetch(WORKER_ORIGIN+'/advertisers/claim-options"),
    2062: ("registrarSolicitudSoporteV73_", "/support/requests", "POST", "fetch(WORKER_ORIGIN+'/support/requests"),
    8358: ("apiSuscriptores_", "/suscriptores", "POST", "fetch(SUSCRIPTORES_URL"),
    2244: ("cargarAltaCompleta_", "/catalogs/public/guide", "GET", "fetch(WORKER_ORIGIN+'/catalogs/public/guide"),
    8596: ("seleccionarAnunciante_", "/commerce", "GET", "/commerce?action=permisos_panel"),
    4240: ("loadActividadesUI", "/actividades", "GET", "WORKER_ACTIVIDADES_URL+'?action=getpaneldata"),
    5144: ("loadPublicidadUI", "/publicidad", "GET", "WORKER_PUBLICIDAD_URL+"),
    9410: ("loadCommerceUI", "/commerce", "GET", "/commerce?action=anunciante"),
    8532: ("cargarCatalogoComerciosSilencioso_", "/advertisers/claim-options", "GET", "/advertisers/claim-options"),
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

    # Clasificación de rutas públicas y de cuenta sin enlazar sitios de otros ámbitos.
    for path, site_map in OTHERS.items():
        source = (ROOT / path).read_text(encoding="utf-8")
        source_lines = source.splitlines()
        if path == "plataforma/suscriptores.html":
            assert "const SUSCRIPTORES_URL = WORKER_ORIGIN + '/suscriptores'" in source
        if path in ("plataforma/carcasa.html", "plataforma/anunciantes.html"):
            assert "const GLD_SUSCRIPTORES_API = 'https://login.liqkoargentina.workers.dev/suscriptores'" in source
        if path == "plataforma/farma_turnos.html":
            assert "const API_URL='https://login.liqkoargentina.workers.dev/farmacias'" in source
            assert "const PUBLICIDAD_URL='https://login.liqkoargentina.workers.dev/publicidad'" in source
            assert "u.searchParams.set('action','turnos')" in source
            assert "p.searchParams.set('action','publicas')" in source
        if path == "plataforma/promos.html":
            assert 'const DATA_URL = "https://login.liqkoargentina.workers.dev/promos"' in source
        if path == "plataforma/terminos-anunciantes.js":
            assert "origin+'/advertiser/terms'" in source
        for line, (route, method) in site_map.items():
            site = source_lines[line - 1]
            if "fetch(" not in site:
                raise ValueError(f"Source fetch changed {path}:{line}")
            nearby = "\n".join(source_lines[line-1:line+4])
            if method == "POST" and "method:'POST'" not in nearby:
                raise ValueError(f"POST method changed {path}:{line}")
            if method == "GET" and "method:'POST'" in site:
                raise ValueError(f"GET method changed {path}:{line}")
            if method == "GET_POST" and "method:body?'POST':'GET'" not in site:
                raise ValueError(f"Dynamic GET/POST changed {path}:{line}")
            if route not in worker:
                raise ValueError(f"Worker route not found {route}")
            for entry in entries:
                for network in entry.get("network", []):
                    if network.get("routeStatus") != "backend_candidate":
                        continue
                    if network.get("file") != path or network.get("line") != line:
                        continue
                    if route not in (network.get("candidates") or []):
                        continue
                    old = {
                        "routeStatus": network.get("routeStatus"),
                        "target": network.get("target"),
                        "verb": network.get("verb"),
                        "candidates": (network.get("candidates") or [])[:],
                        "worker": network.get("worker", [])[:],
                    }
                    network["routeStatus"] = "comprobada_condicional"
                    network["target"] = route
                    network["verb"] = method if method != "GET_POST" else None
                    if method == "GET_POST":
                        network["metodosCondicionados"] = ["GET", "POST"]
                    network["candidates"] = [route]
                    network["worker"] = [{
                        "file": "worker/worker206.txt",
                        "evidencia": "Ruta del origen y destino Worker; permisos, action, sesión y filtros condicionan cada rama; no demuestra ejecución",
                    }]
                    network.setdefault("cotejoPaso2Original", old)
                    cotejo = entry.setdefault("cotejoPaso2", {})
                    note = {
                        "sitio": network.get("callId"),
                        "decision": "comprobada_condicional",
                        "metodo": method if method != "GET_POST" else None,
                        "metodosCondicionados": ["GET", "POST"] if method == "GET_POST" else [method],
                        "ruta": route, "origen": path + ":" + str(line),
                        "condiciones": "Ruta y verbo cotejados estáticamente; acción/roles/estado siguen siendo condiciones",
                    }
                    existing = cotejo.setdefault("conexiones", [])
                    if not any(n.get("sitio") == note["sitio"] and n.get("ruta") == route for n in existing):
                        existing.append(note)
                    changed += 1
                    touched.add(entry["id"])
                    evidence.append((entry["id"], path, line, method, route))

    # Cotejo por identidad de función; los offsets del corte histórico no
    # corresponden siempre a las líneas actuales de plataforma/login.html.
    login_source = (ROOT / "plataforma/login.html").read_text(encoding="utf-8")
    for variable, route in (
        ("SUSCRIPTORES_URL", "/suscriptores"),
        ("WORKER_ACTIVIDADES_URL", "/actividades"),
        ("WORKER_PUBLICIDAD_URL", "/publicidad"),
    ):
        if f"const {variable} = WORKER_ORIGIN + '{route}'" not in login_source:
            raise ValueError(f"Source constant changed: {variable}")
    for old_line, (function, route, method, marker) in LOGIN.items():
        declaration = re.search(r"(?:async\\s+)?function\\s+" + re.escape(function) + r"\\s*\\(", login_source)
        if not declaration:
            raise ValueError(f"Login function missing {function}")
        body = login_source[declaration.start():declaration.start()+6500]
        if marker not in body:
            raise ValueError(f"Login route marker changed in {function}: {marker}")
        if method == "POST" and "method:'POST'" not in body:
            raise ValueError(f"Login POST guard changed in {function}")
        if route not in worker:
            raise ValueError(f"Worker route missing: {route}")
        for entry in entries:
            for network in entry.get("network", []):
                if network.get("routeStatus") != "backend_candidate":
                    continue
                if network.get("file") != "plataforma/login.html" or network.get("line") != old_line:
                    continue
                if route not in (network.get("candidates") or []):
                    continue
                previous = {
                    "routeStatus":network.get("routeStatus"),
                    "target":network.get("target"), "verb":network.get("verb"),
                    "candidates":(network.get("candidates") or [])[:],
                    "worker":network.get("worker", [])[:]
                }
                network["routeStatus"] = "comprobada_condicional"
                network["target"] = route
                network["verb"] = method
                network["candidates"] = [route]
                network["worker"] = [{
                    "file":"worker/worker206.txt",
                    "evidencia": f"{function}: ruta y método en el corte, función vigente cotejada; condición y permisos dependen del origen",
                }]
                network.setdefault("cotejoPaso2Original", previous)
                note = {
                    "sitio":network.get("callId"), "decision":"comprobada_condicional",
                    "ruta":route, "metodo":method,
                    "origen":"plataforma/login.html:"+str(old_line),
                    "funcionFuente":function,
                    "condiciones":"Se acredita ruta posible bajo invocación de la función y sus guardas; no se afirma ejecución en arranque ni producción",
                }
                current = entry.setdefault("cotejoPaso2", {}).setdefault("conexiones", [])
                if not any(x.get("sitio")==note["sitio"] and x.get("ruta")==route for x in current):
                    current.append(note)
                changed += 1
                touched.add(entry["id"])
                evidence.append((entry["id"], "plataforma/login.html", old_line, method, route))

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
        for e in entries:
            for n in e.get("network", []):
                if n.get("routeStatus") == "backend_candidate" and n.get("file") == "plataforma/login.html":
                    start=e.get("start", {})
                    print("PASO2_LOGIN_ORIGEN", json.dumps({
                        "id":e.get("id"),"start_file":start.get("file"),"start_line":start.get("line"),
                        "handler":start.get("handler"),"context":start.get("context"),
                        "site":n.get("line"),"callId":n.get("callId"),
                        "from":n.get("from"),"target":n.get("target"),
                        "candidates":n.get("candidates"),"depth":n.get("depth")
                    },ensure_ascii=False))
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
