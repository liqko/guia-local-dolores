from pathlib import Path
root=Path(__file__).resolve().parents[2]
bundle=(root/'worker/WORKER_COMPLETO_V51.js').read_text()
a=bundle.index('// reconstruccion/worker/core/farmacias-read-model-v2.js')
b=bundle.index('// reconstruccion/worker/modules/farmacias-public-v3.js',a)
s=(root/'actualizacion-v38/fuentes/farmacias-read-model-v52.js').read_text()
s='\n'.join(line for line in s.splitlines() if not line.startswith('import '))
s=s.replace('export ', '').replace('const text=', 'const text24=').replace('text(', 'text24(').replace('sortTurnos(', 'sortTurnos2(')
bundle=bundle[:a]+'// reconstruccion/worker/core/farmacias-read-model-v2.js\n'+s+'\n\n'+bundle[b:]
# La función pública calcula turnos desde el paquete ya completo; no hace un join duplicado.
source=(root/'worker/WORKER_COMPLETO_V50.js').read_text()
a0=source.index('async function farmTurnosPublicV3(');b0=source.index('// reconstruccion/worker/routes/public-v12.js',a0)
a=bundle.index('async function farmTurnosPublicV3(');b=bundle.index('// reconstruccion/worker/routes/public-v12.js',a)
bundle=bundle[:a]+source[a0:b0]+bundle[b:]
# Farmacias depende de la guía recién preparada durante rebuild integral.
bundle=bundle.replace('''  const [
    guide,
    promos,''','''  const guideReady = rebuildGuideAllV2({ db, cache });
  const [
    guide,
    promos,''',1).replace('''    rebuildGuideAllV2({ db, cache }),''','''    guideReady,''',1).replace('''    rebuildFarmAllV2({ db, cache }),''','''    guideReady.then(() => rebuildFarmAllV2({ db, cache })),''',1)
bundle=bundle.replace("worker_version:'51'","worker_version:'52'").replace('version:"51"','version:"52"')
assert 'guideReady.then' in bundle
(root/'worker/WORKER_COMPLETO_V52.js').write_text(bundle)
(root.parent/'WORKER_COMPLETO_V52.txt').write_text(bundle)
print(len(bundle.encode()),'bytes')
