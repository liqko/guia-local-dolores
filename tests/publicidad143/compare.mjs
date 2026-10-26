import {spawnSync} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const results=[];
for(const scenario of ['commercial-noop','publicity-cold','promos-cold','publicity-create','promos-create']){
 const pair={};
 for(const version of [140,143]){
  const resultPath=`/tmp/pub143-${version}-${scenario}.json`,source=`worker/login-${version===140?'efemerides140':'publicidad143'}.mjs`;
  const run=spawnSync(process.execPath,['tests/publicidad143/consumption.mjs'],{env:{...process.env,GLD_WORKER_SOURCE:source,SCENARIO:scenario,RESULT_PATH:resultPath},encoding:'utf8'});
  if(run.status!==0)throw Error(run.stdout.slice(-1000)+run.stderr.slice(-1500));
  pair[version]=JSON.parse(fs.readFileSync(resultPath,'utf8'));
 }
 assert(pair[143].firestore.write_calls<=pair[140].firestore.write_calls);
 assert(pair[143].kv.put<=pair[140].kv.put);
 if(scenario.endsWith('-cold'))assert(pair[143].fixture_sql.rows_read<pair[140].fixture_sql.rows_read);
 results.push(pair);console.log(scenario,JSON.stringify(Object.fromEntries(Object.entries(pair).map(([v,r])=>[v,{fs:r.firestore,kv:r.kv,sql:r.fixture_sql,do:r.do_storage_calls}]))));
}
fs.writeFileSync('docs/evidencias/publicidad143-local-comparison.json',JSON.stringify(results,null,2)+'\n');
