const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const output=process.env.GLD_AUDIT_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'gld-worker-audit-'));fs.mkdirSync(output,{recursive:true});
const env={...process.env,GLD_AUDIT_OUTPUT:output};
for(const file of ['inspect.cjs','mutations.cjs'])execFileSync(process.execPath,[path.join(__dirname,file)],{env,stdio:'inherit'});
console.log('Evidence directory:',output);
