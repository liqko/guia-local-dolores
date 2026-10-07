from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=(root/'actualizacion-v38/fuentes/farmacias-panel-v50.js').read_text()
bundle=(root/'worker/WORKER_COMPLETO_V49.js').read_text()
marker='var {farmaciasPanelDataV3} = (() => {'
a=bundle.index(marker);b=bundle.index('\n})();',a)+len('\n})();')
bundle=bundle[:a]+marker+'\n'+source.replace('export async function','async function')+'\nreturn {farmaciasPanelDataV3};\n})();'+bundle[b:]
bundle=bundle.replace("worker_version:'49'","worker_version:'50'").replace('version:"49"','version:"50"')
(root/'worker/WORKER_COMPLETO_V50.js').write_text(bundle)
(root.parent/'WORKER_COMPLETO_V50.txt').write_text(bundle)
print('Worker V50 generado:',len(bundle.encode()),'bytes')
