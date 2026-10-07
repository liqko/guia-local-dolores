from pathlib import Path
root=Path(__file__).resolve().parents[2]
s=(root/'actualizacion-v38/fuentes/farmacias-public-v51.js').read_text()
bundle=(root/'worker/WORKER_COMPLETO_V50.js').read_text()
a=bundle.index('async function farmTurnosPublicV3(')
b=bundle.index('\n// reconstruccion/worker/routes/public-v12.js',a)
function=s[s.index('export async function farmTurnosPublicV3('):].replace('export async function','async function').replace('text(', 'text25(')
bundle=bundle[:a]+function+'\n'+bundle[b:]
bundle=bundle.replace("worker_version:'50'","worker_version:'51'").replace('version:"50"','version:"51"')
(root/'worker/WORKER_COMPLETO_V51.js').write_text(bundle)
(root.parent/'WORKER_COMPLETO_V51.txt').write_text(bundle)
print('Worker V51:',len(bundle.encode()),'bytes')
