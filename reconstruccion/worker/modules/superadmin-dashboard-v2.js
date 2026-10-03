import {ADMIN_ADVERTISERS_KEY,ADMIN_SUBSCRIBERS_KEY} from "../core/admin-indexes-v2.js";

export async function superadminDashboardV2({cache}){
  const [adv,sub,territory]=await Promise.all([
    cache.get(ADMIN_ADVERTISERS_KEY),
    cache.get(ADMIN_SUBSCRIBERS_KEY),
    cache.get("territorio:admin:v1")
  ]);

  return{
    success:true,
    resumen:{
      suscriptores:sub&&Array.isArray(sub.results)?sub.results.length:0,
      anunciantes:adv&&Array.isArray(adv.results)?adv.results.length:0,
      ciudades:territory&&Array.isArray(territory.ciudades)?territory.ciudades.length:0
    },
    source:"kv"
  };
}
