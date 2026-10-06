from pathlib import Path
root=Path(__file__).resolve().parents[2]
modular=root.parent/'guia-local-dolores/reconstruccion/worker'
bundle=(root/'worker/WORKER_COMPLETO_V45.js').read_text()
def source(path):
    text=(modular/path).read_text()
    return '\n'.join(line for line in text.splitlines() if not line.startswith('import ')).replace('export async function','async function').replace('export function','function')
start=bundle.index('// reconstruccion/worker/modules/suscriptor-favoritos-v2.js')
end=bundle.index('// reconstruccion/worker/routes/panel-v6.js',start)
names='listFavoritesV2,addFavoriteV2,removeFavoriteV2'
bundle=bundle[:start]+'// reconstruccion/worker/modules/suscriptor-favoritos-v2.js\nvar {'+names+'} = (() => {\n'+source('modules/suscriptor-favoritos-v2.js')+'\nreturn {'+names+'};\n})();\n\n'+bundle[end:]
start=bundle.index('// reconstruccion/worker/core/login-cache-v45.js')
entry=source('app-main-v35.js').replace('export default{','var app_main_v35_default = {')
bundle=bundle[:start]+'// reconstruccion/worker/core/private-cache-v46.js\nvar withPrivateCacheV46 = (() => {\n'+source('core/private-cache-v46.js')+'\nreturn withPrivateCacheV46;\n})();\n\n// reconstruccion/worker/app-main-v35.js\n'+entry+'\nexport {app_main_v35_default as default};\n'
(root/'worker/WORKER_COMPLETO_V46.js').write_text(bundle)
print('Worker V46 completo:',len(bundle.encode()),'bytes')
