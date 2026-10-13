/* Account support uses the existing Worker/GH circuit. No requests until user action. */
(function(root){
 'use strict';
 root.GLD_SUPPORT={mount(host,options){
  if(!host)return null;
  let owner='',requests=null;
  const node=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
  const detail=node('details'),summary=node('summary','Solicitar soporte por el sistema');detail.appendChild(summary);
  detail.appendChild(node('p','Tu consulta queda registrada y el equipo de Guía Local la atiende desde el sistema.'));
  const form=node('form'),label=node('label','¿Qué necesitás resolver?'),input=node('textarea');input.id='cuenta-soporte-detalle';input.rows=4;input.maxLength=2000;input.minLength=5;input.required=true;input.style.cssText='display:block;width:100%;box-sizing:border-box;min-height:112px;resize:vertical;margin:8px 0';label.htmlFor=input.id;
  const send=node('button','Enviar solicitud');send.type='submit';send.className='primary';form.appendChild(label);form.appendChild(input);form.appendChild(send);detail.appendChild(form);
  const status=node('p');status.setAttribute('role','status');detail.appendChild(status);host.appendChild(detail);
  const mine=node('button','Mis solicitudes y respuestas');mine.type='button';mine.className='mi-guia-secondary';mine.style.cssText='display:block;width:100%;margin:12px 0;min-height:44px';host.appendChild(mine);
  const list=node('div'),conversation=node('div');host.appendChild(list);host.appendChild(conversation);
  const identity=()=>String(options.account()?.suscriptor_id||'');
  function sync(){const id=identity();if(owner!==id){owner=id;requests=null;input.value='';status.textContent='';list.replaceChildren();conversation.replaceChildren();}}
  async function request(path,data){
   sync();const id=owner,token=options.token();if(!id||!token)throw new Error('Ingresá a tu cuenta para solicitar soporte.');
   const r=await fetch(options.origin+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
   const result=await r.json();if(!r.ok||!result.success)throw new Error(result.message||'No se pudo completar la solicitud.');
   if(identity()!==id)throw new Error('La cuenta cambió. Abrí soporte desde tu sesión actual.');return result;
  }
  function rows(){
   list.replaceChildren();
   if(!requests?.length)list.appendChild(node('p','No tenés solicitudes registradas.'));
   for(const row of requests||[]){const button=node('button',(row.tipo==='RECUPERACION'?'Ayuda de acceso':'Soporte')+' · '+row.estado+' · '+row.solicitud_id);button.type='button';button.style.cssText='display:block;width:100%;margin:6px 0;min-height:44px';button.onclick=()=>open(row.solicitud_id,button);list.appendChild(button);}
   const refresh=node('button','Actualizar solicitudes');refresh.type='button';refresh.onclick=()=>load(true);list.appendChild(refresh);
  }
  async function load(refresh=false){
   sync();mine.disabled=true;
   try{if(requests===null||refresh){const result=await request('/support/mine');requests=result.results||[];}rows();}
   catch(error){status.textContent=error.message;}finally{mine.disabled=false;}
  }
  async function open(id,button){
   if(button)button.disabled=true;
   try{const result=await request('/support/conversation?solicitud_id='+encodeURIComponent(id));conversation.replaceChildren();
    conversation.appendChild(node('h4','Solicitud '+id));conversation.appendChild(node('p',result.solicitud.detalle));
    for(const message of result.mensajes||[])conversation.appendChild(node('p',(message.autor==='ADMIN'?'Soporte':'Vos')+': '+message.texto));
    if(result.solicitud.resolucion)conversation.appendChild(node('p','Resolución: '+result.solicitud.resolucion));
    if(result.solicitud.estado!=='CERRADA'){
     const reply=node('textarea');reply.rows=4;reply.maxLength=2000;reply.setAttribute('aria-label','Tu respuesta');reply.style.cssText=input.style.cssText;conversation.appendChild(reply);
     const answer=node('button','Enviar respuesta');answer.type='button';conversation.appendChild(answer);const key=crypto.randomUUID();
     answer.onclick=async()=>{if(!reply.value.trim())return;answer.disabled=true;try{await request('/support/reply',{solicitud_id:id,texto:reply.value.trim(),request_key:key});await open(id);}catch(error){status.textContent=error.message;answer.disabled=false;}};
    }
   }catch(error){status.textContent=error.message;}finally{if(button)button.disabled=false;}
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();sync();const text=input.value.trim();if(text.length<5){status.textContent='Escribí al menos 5 caracteres.';return;}if(text.length>2000){status.textContent='El mensaje admite hasta 2000 caracteres.';return;}
   send.disabled=true;status.textContent='Registrando solicitud...';
   try{
    const account=options.account(),draft=JSON.stringify([owner,text]);let drafts={};try{drafts=JSON.parse(localStorage.getItem('gld_support_drafts_v74')||'{}');}catch{}
    const key=drafts[draft]||(drafts[draft]=crypto.randomUUID());try{localStorage.setItem('gld_support_drafts_v74',JSON.stringify(drafts));}catch{}
    const result=await request('/support/requests',{tipo:'SOPORTE',mail:account.mail,nombre:account.nombre||'',whatsapp:account.whatsapp||'',detalle:text,request_key:key});
    status.textContent='Solicitud '+result.solicitud_id+' registrada. Podés seguir la respuesta en Mis solicitudes y respuestas.';
    if(requests!==null){requests=requests.filter(row=>row.solicitud_id!==result.solicitud_id);requests.unshift({solicitud_id:result.solicitud_id,tipo:'SOPORTE',estado:result.estado||'PENDIENTE',detalle:text});rows();}
   }catch(error){status.textContent=error.message;}finally{send.disabled=false;}
  });
  mine.onclick=()=>load();
  return {reset:sync};
 }};
})(window);
