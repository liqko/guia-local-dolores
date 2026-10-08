(() => {
  'use strict';
  const selector='input[maxlength]:not([type="password"]),textarea[maxlength]';
  let nextId=0,queued=false;
  const counters=new WeakMap();
  function update(field){
    const max=Number(field.getAttribute('maxlength'));
    if(!Number.isFinite(max)||max<0)return;
    let counter=counters.get(field);
    if(!counter||!counter.isConnected){
      counter=document.createElement('div');
      counter.id='gld-character-counter-'+(++nextId);
      counter.className='gld-character-counter';
      counter.setAttribute('aria-live','polite');
      field.insertAdjacentElement('afterend',counter);
      const descriptions=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);
      descriptions.push(counter.id);field.setAttribute('aria-describedby',descriptions.join(' '));
      counters.set(field,counter);
    }
    const count=String(field.value||'').length,over=count>max;
    const message=count+' / '+max+' caracteres'+(over?' — supera el límite; ajustá el texto antes de guardar.':count===max?' — límite alcanzado.':'');
    if(counter.textContent!==message)counter.textContent=message;
    counter.classList.toggle('gld-character-counter-over',over);
  }
  function refresh(){document.querySelectorAll(selector).forEach(update);}
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});}
  function changed(event){if(event.target.matches?.(selector))update(event.target);}
  function mount(){
    const style=document.createElement('style');
    style.textContent='.gld-character-counter{display:block;text-align:right;font-size:.8rem;color:#555;margin:4px 0 8px;overflow-wrap:anywhere}.gld-character-counter-over{color:#b00020;font-weight:600}';
    document.head.appendChild(style);
    for(const name of ['input','change','focusin'])document.addEventListener(name,changed);
    document.addEventListener('click',schedule);
    document.addEventListener('submit',event=>{
      const fields=event.target.querySelectorAll?.(selector)||[];
      for(const field of fields){
        if(field.disabled||field.offsetParent===null)continue;
        update(field);
        if(String(field.value||'').length>Number(field.getAttribute('maxlength'))){event.preventDefault();event.stopImmediatePropagation();field.focus();return;}
      }
    },true);
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['maxlength']});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
