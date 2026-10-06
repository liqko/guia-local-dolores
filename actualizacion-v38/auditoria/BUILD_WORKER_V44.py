# Actualización reproducible del bundle V43 conservando módulos sin cambios.
from pathlib import Path
root=Path(__file__).resolve().parents[2]
modular=root.parent/'guia-local-dolores/reconstruccion/worker'
bundle=(root/'worker/WORKER_COMPLETO_V43.js').read_text()
http=(modular/'core/http.js').read_text()
cors=http.split('export function cors()',1)[1].split('export function json(',1)[0]
start=bundle.index('function cors()');end=bundle.index('function json(',start)
bundle=bundle[:start]+'function cors()'+cors+bundle[end:]
obs=(modular/'core/db-observation-v41.js').read_text()
guard=obs.split('export function publicDbGuardV44',1)[1].split('// Sólo etiquetas conocidas',1)[0]
entry=(modular/'app-main-v35.js').read_text()
entry='\n'.join(line for line in entry.splitlines() if not line.startswith('import '))
entry=entry.replace('export default{','var app_main_v35_default = {')
marker='// reconstruccion/worker/app-main-v35.js'
assert bundle.count(marker)==1
bundle=bundle[:bundle.index(marker)]+'function publicDbGuardV44'+guard+'\n'+marker+'\n'+entry+'\nexport {app_main_v35_default as default};\n'
(root/'worker/WORKER_COMPLETO_V44.js').write_text(bundle)
print('Worker V44 completo:',len(bundle.encode()),'bytes')
