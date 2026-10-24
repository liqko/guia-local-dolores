import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
let source=await readFile(new URL('worker/base-observado136.mjs',root),'utf8');
const module=await readFile(new URL('worker/observabilidad/telemetry.mjs',root),'utf8');
function replace(from,to){if(!source.includes(from))throw Error('La base activa cambió: '+from.slice(0,80));source=source.replace(from,to);}
replace('class GldPublicCache119 {\n constructor(state,env){\n  this.state=state;this.env=env;this.sql=state.storage.sql;this.cached=null;',
  'class GldPublicCache119 {\n constructor(state,env){\n  this.state=state;this.env=env;this.sql=state.storage.sql;this.cached=null;\n  if(state.id?.name?.startsWith(GldTelemetry137.TELEMETRY_PREFIX)){this.telemetry137=new GldTelemetry137.GldTelemetryStore137(state);return;}');
replace(' async fetch(request){\n  // Preserve ordering', ' async fetch(request){\n  if(this.telemetry137)return this.telemetry137.fetch(request);\n  // Preserve ordering');
replace('GldPublicCache119.prototype.alarm=async function(){','GldPublicCache119.prototype.alarm=async function(){\n if(this.telemetry137)return this.telemetry137.alarm();');
replace('  async fetch(request,env){\n    const report=',`  async fetch(request,env,executionCtx){
    const telemetryEnv137=env;
    const telemetryUrl137=new URL(request.url);
    if(request.method!=='OPTIONS'&&['/telemetry/events','/superadmin/telemetry'].includes(telemetryUrl137.pathname)){
      try{return await GldTelemetry137.routeTelemetry({request,env,url:telemetryUrl137,verifyAdmin});}
      catch{return json({success:false,message:'No se pudo consultar el registro.'},503);}
    }
    const report=`);
replace('      if(request.method!=="OPTIONS")console.log(JSON.stringify(finishObservationV42(report)));',`      report.consumption=consumption136(report);
      console.log(JSON.stringify(finishObservationV42(report)));
      if(!request.url.includes('/diagnostics/'))await GldTelemetry137.publishRecord(telemetryEnv137,executionCtx,GldTelemetry137.serverRecord(report,request,!!env.__gldGuideActor132));`);
replace('"Content-Type,Authorization,X-GLD-Adult-Token"','"Content-Type,Authorization,X-GLD-Adult-Token,X-GLD-Trace"');
replace('if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});','if(request.method==="OPTIONS"){report.status=204;return new Response(null,{status:204,headers:cors()});}');
replace('"Access-Control-Expose-Headers":"X-GLD-Request-Id,','"Access-Control-Max-Age":"600",\n    "Access-Control-Expose-Headers":"X-GLD-Consumption,X-GLD-Request-Id,');
source=source.replaceAll("worker_version:'136'","worker_version:'137'").replaceAll('version:"136"','version:"137"');
// One deployable module, generated from the observed active source and isolated new code.
source='const GldTelemetry137=(()=>{\n'+module.replace(/^export /gm,'')+'\nreturn {TELEMETRY_PREFIX,GldTelemetryStore137,routeTelemetry,publishRecord,serverRecord};})();\n\n'+source;
const output=process.argv[2]||fileURLToPath(new URL('worker/login-observabilidad137.mjs',root));
await writeFile(output,source);
console.log(output);
