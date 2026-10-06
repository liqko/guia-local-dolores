from pathlib import Path
root=Path(__file__).resolve().parents[2]
modular=root.parent/'guia-local-dolores/reconstruccion/worker'
bundle=(root/'worker/WORKER_COMPLETO_V44.js').read_text()
def isolated(path,name):
    source=(modular/path).read_text()
    source='\n'.join(line for line in source.splitlines() if not line.startswith('import '))
    source=source.replace('export async function','async function').replace('export function','function')
    return 'var '+name+' = (() => {\n'+source+'\nreturn '+name+';\n})();\n'
marker='// reconstruccion/worker/modules/suscriptor-login-v2.js'
following='// reconstruccion/worker/modules/suscriptor-registro-v3.js'
start=bundle.index(marker);end=bundle.index(following,start)
bundle=bundle[:start]+marker+'\n'+isolated('modules/suscriptor-login-v2.js','subscriberLoginV2')+'\n'+bundle[end:]
marker='// reconstruccion/worker/app-main-v35.js'
entry=(modular/'app-main-v35.js').read_text()
entry='\n'.join(line for line in entry.splitlines() if not line.startswith('import '))
entry=entry.replace('export default{','var app_main_v35_default = {')
bundle=bundle[:bundle.index(marker)]+'// reconstruccion/worker/core/login-cache-v45.js\n'+isolated('core/login-cache-v45.js','withLoginCacheV45')+'\n'+marker+'\n'+entry+'\nexport {app_main_v35_default as default};\n'
(root/'worker/WORKER_COMPLETO_V45.js').write_text(bundle)
print('Worker V45 completo:',len(bundle.encode()),'bytes')
