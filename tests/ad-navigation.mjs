import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for(const name of ['anunciantes.html','eventos.html']){
 const html=fs.readFileSync(new URL('../plataforma/'+name,import.meta.url),'utf8');
 const start=html.indexOf('function attachCtaHandlers()');
 const end=html.indexOf('function replayBannerMediaById(',start);
 assert(start>=0&&end>start);
 let clicks=0,prevented=0;
 const cta={target:'',getAttribute:()=> 'https://advertiser.example/',click:()=>clicks++};
 const media={setAttribute(){},querySelector:()=>null};
 const card={dataset:{cta:'https://advertiser.example/'},classList:{add(){},remove(){}},querySelector:s=>s==='.cta-btn'?cta:media};
 const context=vm.createContext({document:{querySelectorAll:()=>[card]},console});
 vm.runInContext(html.slice(start,end),context);context.attachCtaHandlers();
 assert.equal(cta.target,'_top');assert.equal(cta.onclick,undefined);
 media.onclick({target:{tagName:'IMG'},preventDefault:()=>prevented++});
 assert.equal(clicks,1);assert.equal(prevented,1);
 media.onclick({target:{tagName:'VIDEO'},preventDefault:()=>prevented++});assert.equal(clicks,1);
}
for(const name of ['anunciantes.html','eventos.html','promos.html','actividades.html','farma_turnos.html']){
 const html=fs.readFileSync(new URL('../plataforma/'+name,import.meta.url),'utf8');
 for(const match of html.matchAll(/<a class="(?:cta-btn|banner-cta)"[^>]*>/g))assert(match[0].includes('target="_top"'));
 for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
}
console.log('PASS: image delegates to native CTA; CTA targets current top-level tab; video interaction preserved; no requests or writes');
