/* Guía Local: paginación visual compartida. Sin red, Firestore ni caché. */
(function(global){
  'use strict';
  const PAGE_SIZE=10;
  const pageSize=()=>PAGE_SIZE;
  const pageCount=(total,size=PAGE_SIZE)=>Math.max(1,Math.ceil(Math.max(0,Number(total)||0)/size));
  const clamp=(page,pages)=>Math.max(1,Math.min(pageCount(pages,1),Math.floor(Number(page)||1)));
  const slice=(items,page,size=PAGE_SIZE)=>(items||[]).slice((clamp(page,pageCount((items||[]).length,size))-1)*size,clamp(page,pageCount((items||[]).length,size))*size);
  function numbers(page,total){
    const n=Math.max(1,Math.floor(Number(total)||1)),p=clamp(page,n),keep=new Set([1,n]);
    for(let i=Math.max(1,p-2);i<=Math.min(n,p+2);i++)keep.add(i);
    const sorted=[...keep].sort((a,b)=>a-b),result=[];
    for(let i=0;i<sorted.length;i++){
      if(i && sorted[i]-sorted[i-1]>1){
        if(sorted[i]-sorted[i-1]===2)result.push(sorted[i-1]+1);
        else result.push('…');
      }
      result.push(sorted[i]);
    }
    return result;
  }
  function render({bar,container,prev,next,page=1,totalItems,totalPages,onChange,hideSingle=true,showAs='flex'}={}){
    if(!bar || typeof onChange!=='function')return;
    const pages=totalPages==null?pageCount(totalItems):Math.max(1,Math.ceil(Number(totalPages)||1));
    const current=clamp(page,pages),visible=!hideSingle||pages>1;
    if(container){container.hidden=!visible;container.style.display=visible?showAs:'none';}
    if(prev){prev.disabled=current<=1;prev.onclick=()=>{if(current>1)onChange(current-1);};}
    if(next){next.disabled=current>=pages;next.onclick=()=>{if(current<pages)onChange(current+1);};}
    bar.replaceChildren();
    for(const num of numbers(current,pages)){
      if(num==='…'){const span=document.createElement('span');span.className='dots';span.textContent='…';bar.appendChild(span);}
      else if(num===current){const span=document.createElement('span');span.className='active';span.setAttribute('aria-current','page');span.textContent=String(num);bar.appendChild(span);}
      else{const btn=document.createElement('button');btn.type='button';btn.textContent=String(num);btn.setAttribute('aria-label','Ir a la página '+num);btn.onclick=()=>onChange(num);bar.appendChild(btn);}
    }
  }
  global.GLD_PAGINACION=Object.freeze({pageSize,pageCount,clamp,slice,numbers,render});
})(window);
