from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
source = (root.parent / 'guia-local-dolores/reconstruccion/worker/routes/panel-v4.js').read_text()
start = source.index('function farmFeatureEnabled(')
end = source.index('\nfunction cupo(', start)
helper = source[start:end]
helper = helper.replace('text(v)', 'String(v??"\").trim()')
helper = helper.replace('text(admin&&admin.funcionalidades)', 'String(admin?.funcionalidades??"\").trim()')
helper = helper.replace('truthy(value)', '(value===true||value===1||["true","1","si","sí","x","activo","activa"].includes(String(value??"\").trim().toLowerCase()))')
bundle = (root / 'worker/WORKER_COMPLETO_V48.js').read_text()
marker = '// reconstruccion/worker/routes/panel-v4.js'
start = bundle.index(marker)
end = bundle.index('\n// reconstruccion/worker/', start + len(marker))
section = bundle[start:end].replace('function featureEnabled2(', helper + '\nfunction featureEnabled2(', 1)
section, count = re.subn(r'featureAllowed: \(a\) => featureEnabled\d*\(a, "TURNOS_FARMA"\) \|\| truthy\d*\(a && a.turnos_farma\)', 'featureAllowed: farmFeatureEnabled', section)
assert count == 1, count
bundle = bundle[:start] + section + bundle[end:]
bundle = bundle.replace("worker_version:'48'", "worker_version:'49'").replace('version:"48"', 'version:"49"')
(root / 'worker/WORKER_COMPLETO_V49.js').write_text(bundle)
(root.parent / 'WORKER_COMPLETO_V49.txt').write_text(bundle)
print('Worker V49 completo:', len(bundle.encode()), 'bytes')
