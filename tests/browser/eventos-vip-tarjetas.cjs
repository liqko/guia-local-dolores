const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const path = 'plataforma/login.html';
const origin = 'https://fixture.invalid';

async function exercise(browser, source) {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const posts = [];
  try {
    await page.route('**/*', async route => {
      if (route.request().url() === origin + '/') {
        return route.fulfill({ contentType: 'text/html', body: '<main id="eventos-list"></main>' });
      }
      assert.equal(route.request().url(), origin + '/events');
      posts.push(route.request().postDataJSON());
      return route.fulfill({ json: { success: true } });
    });
    await page.goto(origin);
    const cards = source.slice(source.indexOf('function renderEventsCards('), source.indexOf('async function eventAbrirFormulario_('));
    const actions = source.slice(source.indexOf('function bindEventsListActions('), source.indexOf('function eventRefreshLocal_('));
    assert(cards.includes('card-actions') && actions.includes('function renderEventsList('));
    await page.addScriptTag({ content: `
      const htmlEscape=String, formatDateForTable=String, formatTimeForTable=String, eventCityLabel=String;
      const eventExpired146=()=>false, eventStatus146=e=>e.pausado?'Pausado':'Activo', eventExpiryNote146=()=>'';
      const publicacionPausada=e=>!!e.pausado, gldRevisionEstado_=(...args)=>args.at(-1);
      const sesion={eventos_cant:3}, calcularCupoPublicacion=()=>({puedeCrear:true,puedeActivar:true});
      const setMsg=()=>{}, runDashboardAction=(_msg,callback)=>callback();
      const confirmarBorrado_=()=>confirm('¿Borrar evento?');
      const eventAbrirFormulario_=(row,copy=false)=>window.calls.push([copy?'duplicate':'edit',row.evento_id]);
      const pubDesdeContenido147=(type,id)=>window.calls.push([type,id]);
      async function events_post(payload) {
        const response=await fetch('/events',{method:'POST',body:JSON.stringify(payload)});
        return {status:response.status,json:await response.json()};
      }
      function eventUpsertLocal_(row){window.__lastEvents=[row];renderEventsList(window.__lastEvents);}
      function eventRemoveLocal_(){window.__lastEvents=[];renderEventsList([]);}
      ${cards}
      ${actions}
      window.calls=[];
      window.__lastEvents=[{evento_id:'event-1',nombre_evento:'Feria',fecha:'2026-12-01'}];
      renderEventsList(window.__lastEvents);
    ` });
    const card = page.locator('#eventos-list details');
    await card.locator('summary').click();
    await card.getByRole('button', { name: 'Editar' }).click();
    await card.getByRole('button', { name: 'Duplicar' }).click();
    await card.getByRole('button', { name: /Promocioná/ }).click();
    assert.deepEqual(await page.evaluate(() => window.calls), [
      ['edit', 'event-1'], ['duplicate', 'event-1'], ['EVENTO', 'event-1']
    ]);
    page.once('dialog', dialog => dialog.dismiss());
    await card.getByRole('button', { name: 'Borrar' }).click();
    assert.equal(posts.length, 0);
    await card.getByRole('button', { name: 'Pausar' }).click();
    await card.getByText('Pausado', { exact: true }).waitFor();
    await card.locator('summary').click();
    await card.getByRole('button', { name: 'Reanudar' }).click();
    await card.getByText('Activo', { exact: true }).waitFor();
    await card.locator('summary').click();
    page.once('dialog', dialog => dialog.accept());
    await card.getByRole('button', { name: 'Borrar' }).click();
    await page.getByText('No hay eventos cargados.').waitFor();
    assert.deepEqual(posts, [
      { action:'pauseVipEvent', payload:{ evento_id:'event-1', pause:true } },
      { action:'pauseVipEvent', payload:{ evento_id:'event-1', pause:false } },
      { action:'deleteVipEvent', payload:{ evento_id:'event-1' } }
    ]);
    return { posts: posts.length, htmlBytes: Buffer.byteLength(source.replaceAll('\r\n', '\n')) };
  } finally { await page.close(); }
}

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.GLD_CHROME, args: ['--no-sandbox'] });
  try {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\\brenderEventsTable\\b/);
    const after = await exercise(browser, source);
    console.log('Eventos VIP, candidato:', after);
    if (process.env.GLD_COMPARAR_REF) {
      const base = execFileSync('git', ['show', process.env.GLD_COMPARAR_REF + ':' + path], { encoding:'utf8', maxBuffer:1_000_000 });
      const before = await exercise(browser, base);
      assert.equal(after.posts, before.posts);
      assert(after.htmlBytes < before.htmlBytes);
      console.log('Eventos VIP, base:', before);
    }
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
