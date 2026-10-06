export function cors(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type,Authorization",
    "Access-Control-Expose-Headers":"X-GLD-Request-Id,X-GLD-Worker-Version,X-GLD-Read-Calls,X-GLD-Documents-Returned,X-GLD-Write-Calls,X-GLD-Delete-Calls,X-GLD-Source,X-GLD-Public-Blocked"
  };
}
export function json(data,status=200,extraHeaders={}){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors(),...extraHeaders}});
}
export function publicJson(data,status=200){
  return json(data,status,{"Cache-Control":"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"});
}
