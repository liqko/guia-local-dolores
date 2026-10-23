import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../worker/login-guia131.mjs',import.meta.url),'utf8');
const marker='finishObservationV42(report);';
if(!source.includes(marker))throw Error('No se encontró el punto de medición del Worker.');
const instrumented=source.replace(marker,marker+'globalThis.__circuitCapture?.(structuredClone(report));');
const module=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
export default module.default;
export const GldPublicCache119=module.GldPublicCache119;
