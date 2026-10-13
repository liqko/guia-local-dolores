/* Rendering-only image addresses. No requests, storage writes or data mutations. */
(function(root){
 'use strict';
 /** @param {unknown} value @returns {string} */
 function imageUrl(value){
  const raw=String(value??'').trim();if(!raw)return '';
  let parsed;try{parsed=new URL(raw);}catch{return raw;}
  if(!['https:','http:'].includes(parsed.protocol)||!['drive.google.com','docs.google.com'].includes(parsed.hostname.toLowerCase()))return raw;
  const match=parsed.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  const id=match?.[1]||(['/', '/open','/uc','/thumbnail'].includes(parsed.pathname)?parsed.searchParams.get('id'):'');
  if(!id||!/^[A-Za-z0-9_-]+$/.test(id))return raw;
  return 'https://lh3.googleusercontent.com/d/'+id;
 }
 /** @param {unknown} value @returns {string} */
 function imageAttr(value){return imageUrl(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#039;');}
 root.GLD_MEDIA={imageUrl,imageAttr};
})(window);
