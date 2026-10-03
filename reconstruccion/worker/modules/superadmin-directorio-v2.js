import {
  searchAdvertisersV2,searchSubscribersV2,advertiserDetailV2,subscriberDetailV2
} from "../core/admin-indexes-v2.js";

const text=v=>String(v??"").trim();

export async function adminSearchAdvertisersV2({cache,url}){
  return searchAdvertisersV2({
    cache,
    q:text(url.searchParams.get("q")),
    cityId:text(url.searchParams.get("ciudad_id")),
    limit:Number(url.searchParams.get("limit")||100)
  });
}
export async function adminSearchSubscribersV2({cache,url}){
  return searchSubscribersV2({
    cache,
    q:text(url.searchParams.get("q")),
    tipo:text(url.searchParams.get("tipo")),
    limit:Number(url.searchParams.get("limit")||100)
  });
}
export async function adminAdvertiserDetailV2({db,id}){
  return advertiserDetailV2({db,advertiserId:id});
}
export async function adminSubscriberDetailV2({db,id}){
  return subscriberDetailV2({db,subscriberId:id});
}
