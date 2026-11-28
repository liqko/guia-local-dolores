/* Apariencia compartida GLD. Sin API, cookies ni dependencias. */
(function () {
  'use strict';
  if (window.GLDApariencia) return;
  const root=document.documentElement, key='gld_apariencia', options=['auto','light','dark'];
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const embedded=window.top!==window;
  const valid=value=>options.includes(value)?value:'auto';
  function read(){try{return valid(localStorage.getItem(key));}catch(_){return 'auto';}}
  let preference=read(), control=null;
  const css=document.createElement('style');
  css.textContent=`
    :root[data-gld-theme="light"]{color-scheme:light}
    :root[data-gld-theme="dark"]{
      color-scheme:dark;
      --gld-theme-bg:#111820;--gld-theme-surface:#202b35;--gld-theme-soft:#283744;
      --gld-theme-blue-soft:#20394a;--gld-theme-green-soft:#203e35;--gld-theme-warm-soft:#43342b;
      --gld-theme-red-soft:#432b31;--gld-theme-purple-soft:#342e47;
      --gld-theme-text:#e6edf3;--gld-theme-muted:#b8c7d2;--gld-theme-link:#8cd2ff;
      --gld-theme-success:#91e0ad;--gld-theme-danger:#ffb4ae;--gld-theme-warn:#ffd09a;
      --gld-theme-purple:#d9c5ff;--gld-theme-border:#526778;
      color:var(--gld-theme-text);
    }
    :root[data-gld-theme="dark"]:not([data-gld-embedded]){background-color:var(--gld-theme-bg)}
    :root[data-gld-theme="dark"] #gldNavegacionGlobal{background:var(--gld-theme-surface);border-color:var(--gld-theme-border)}
    :root[data-gld-theme="dark"] #gldNavegacionGlobal a:not(.gld-volver-guia),:root[data-gld-theme="dark"] #gldNavegacionGlobal summary{color:var(--gld-theme-link)}
    :root[data-gld-theme="dark"] #gldNavegacionGlobal a:not(.gld-volver-guia):is(:hover,:focus-visible,.active){background:var(--gld-theme-blue-soft)}
    :root[data-gld-theme="dark"] #gldPieGlobal,:root[data-gld-theme="dark"] body.gld-identidad-directa{background-color:var(--gld-theme-bg)}
    :root[data-gld-theme="dark"] :is(input,select,textarea){color:var(--gld-theme-text)}
    :root[data-gld-theme="dark"] :is(.guia-loading,.gld-bloqueo-total,#gldModuloBloqueo){background:rgba(17,24,32,.96)!important;color:var(--gld-theme-text)}
    :root[data-gld-theme="dark"] .farma-turno-fixed{background:var(--gld-theme-surface)!important}
    :root[data-gld-theme="dark"] ::placeholder{color:var(--gld-theme-muted);opacity:1}
    #gldApariencia{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:6px 12px;box-sizing:border-box;font:600 13px/1.4 'Segoe UI',Arial,sans-serif;color:var(--gld-theme-text,#263238);background:var(--gld-theme-surface,#fff)}
    #gldApariencia select{appearance:auto;min-width:0;width:auto;max-width:100%;min-height:32px;margin:0;padding:4px 8px;border:1px solid var(--gld-theme-border,#b8c3c8);border-radius:6px;background:var(--gld-theme-surface,#fff);color:var(--gld-theme-text,#263238);font:inherit}
    #gldApariencia select:focus-visible{outline:2px solid var(--gld-theme-link,#006699);outline-offset:2px}
  `;
  (document.head||root).appendChild(css);
  if(embedded)root.setAttribute('data-gld-embedded','');
  function updateMeta(){
    if(embedded||!document.head)return;
    let meta=document.querySelector('meta[name="theme-color"]');
    if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta);}
    if(!meta.dataset.gldLight)meta.dataset.gldLight=meta.content||'#f5f7fa';
    meta.content=root.dataset.gldTheme==='dark'?'#111820':meta.dataset.gldLight;
  }
  function apply(){
    root.dataset.gldTheme=preference==='auto'?(media.matches?'dark':'light'):preference;
    root.dataset.gldAppearance=preference;
    if(control)control.value=preference;
    updateMeta();
  }
  function set(value){preference=valid(value);try{localStorage.setItem(key,preference);}catch(_){}apply();}
  function mount(){
    if(embedded||!document.body||document.getElementById('gldApariencia'))return;
    const label=document.createElement('label');label.id='gldApariencia';label.textContent='Apariencia';
    control=document.createElement('select');control.setAttribute('aria-label','Apariencia');
    for(const [value,title] of [['auto','Automático'],['light','Claro'],['dark','Oscuro']]){
      const option=document.createElement('option');option.value=value;option.textContent=title;control.appendChild(option);
    }
    control.value=preference;control.addEventListener('change',()=>set(control.value));label.appendChild(control);
    const nav=document.getElementById('gldNavegacionGlobal');
    if(nav)nav.appendChild(label);else document.body.prepend(label);
  }
  window.GLDApariencia=Object.freeze({set,mount,get:()=>preference});
  apply();
  const systemChanged=()=>{if(preference==='auto')apply();};
  if(media.addEventListener)media.addEventListener('change',systemChanged);else if(media.addListener)media.addListener(systemChanged);
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=read();apply();}});
  function ready(){updateMeta();if(!embedded)window.setTimeout(mount,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
