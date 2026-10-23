import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.GLD_WORKER_SOURCE||new URL('../../worker/login-guia133.mjs',import.meta.url),'utf8');
const marker='finishObservationV42(report);';
if(!source.includes(marker))throw Error('No se encontró el punto de medición del Worker.');
const instrumented=source.replace(marker,marker+'globalThis.__circuitCapture?.(structuredClone(report));').replace("report.source='guide-dispatch';report.status=guideDispatch.status;", "report.source='guide-dispatch';report.status=guideDispatch.status;finishObservationV42(report);globalThis.__circuitCapture?.(structuredClone(report));");
const module=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
export default module.default;
export const GldPublicCache119=module.GldPublicCache119;
