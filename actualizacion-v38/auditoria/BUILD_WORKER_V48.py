from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
modular=root.parent/'guia-local-dolores/reconstruccion/worker'
bundle=(root/'worker/WORKER_COMPLETO_V47.js').read_text()
def source(path):
    s=(modular/path).read_text()
    return '\n'.join(line for line in s.splitlines() if not line.startswith('import ')).replace('export async function','async function').replace('export function','function')
def replace_module(path):
    global bundle
    marker='// reconstruccion/worker/'+path
    start=bundle.index(marker)
    end=bundle.index('\n// reconstruccion/worker/',start+len(marker))
    raw=(modular/path).read_text()
    names=re.findall(r'export (?:async )?function (\w+)',raw)
    names=','.join(names)
    bundle=bundle[:start]+marker+'\nvar {'+names+'} = (() => {\n'+source(path)+'\nreturn {'+names+'};\n})();\n'+bundle[end:]
for path in ['core/child-rows-patch-v1.js','modules/publicidad-panel-v2.js','modules/farmacias-panel-v3.js','modules/publicidad-v2.js','modules/publicidad-v4.js','modules/farmacias-v3.js','modules/commerce-v3.js']:
    replace_module(path)
needle='async function allowedFarmCities({ db, cache, aid }) {'
assert bundle.count(needle)==1
bundle=bundle.replace(needle,needle+'\n  if(db.panelReadDb)db=db.panelReadDb();')
marker='// reconstruccion/worker/app-main-v35.js'
start=bundle.index(marker)
entry=source('app-main-v35.js').replace('export default{','var app_main_v35_default = {')
bundle=bundle[:start]+'// reconstruccion/worker/core/panel-cache-v48.js\nvar withPanelCacheV48 = (() => {\n'+source('core/panel-cache-v48.js')+'\nreturn withPanelCacheV48;\n})();\n\n'+marker+'\n'+entry+'\nexport {app_main_v35_default as default};\n'
(root/'worker/WORKER_COMPLETO_V48.js').write_text(bundle)
(root.parent/'WORKER_COMPLETO_V48.txt').write_text(bundle)
print('Worker V48 completo:',len(bundle.encode()),'bytes')
