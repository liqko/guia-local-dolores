import {readFileSync} from 'node:fs';
import {source as currentSource} from '../observabilidad/worker-source.mjs';
const source=process.env.GLD_WORKER_SOURCE?readFileSync(process.env.GLD_WORKER_SOURCE,'utf8'):currentSource;
const marker='finishObservationV42(report);';
if(!source.includes(marker))throw Error('No se encontró el punto de medición del Worker.');
const instrumented=source.replace(marker,marker+'globalThis.__circuitCapture?.(structuredClone(report));').replace("report.source='guide-dispatch';report.status=guideDispatch.status;", "report.source='guide-dispatch';report.status=guideDispatch.status;finishObservationV42(report);globalThis.__circuitCapture?.(structuredClone(report));");
const module=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
export default module.default;
export const GldPublicCache119=module.GldPublicCache119;
