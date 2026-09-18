const browserEvents=new Set(['landing_visited','creator_opened','preview_tried','copy_link_clicked','native_share_action','recipient_opened','scratch_started','reveal_completed','recipient_make_card_clicked']);
const hosts=new Set(['https://us.i.posthog.com','https://eu.i.posthog.com']);
export function enabled(host=''){
 return process.env.APP_ENV==='production'&&Boolean(process.env.POSTHOG_KEY)&&hosts.has(process.env.POSTHOG_HOST||'https://us.i.posthog.com')&&!/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}
export function cleanContext(raw={}){
 const allowed=(process.env.ANALYTICS_CAMPAIGNS||'launch,instagram,tiktok,newsletter,friends').split(',');
 const clean=v=>allowed.includes(v)?v:v?'other':undefined;
 const sources=new Set(['direct','internal','google','bing','instagram','facebook','tiktok','x','other']);
 return {page_type:raw.page_type==='recipient'?'recipient':'landing',referral_source:sources.has(raw.referral_source)?raw.referral_source:'direct',utm_source:clean(raw.utm_source),utm_medium:clean(raw.utm_medium),utm_campaign:clean(raw.utm_campaign),from_recipient:raw.from_recipient===true,method:['scratch','button'].includes(raw.method)?raw.method:undefined};
}
export async function capture(event,visitor,raw={},host='',insertId){
 if(!enabled(host)||!browserEvents.has(event)&&!['card_created','recipient_became_creator'].includes(event)||!/^[a-f0-9-]{36}$/.test(visitor||''))return false;
 const properties=cleanContext(raw);properties.distinct_id=visitor;properties.$process_person_profile=false;properties.$geoip_disable=true;properties.$ip=null;properties.$pathname=properties.page_type==='recipient'?'/c/:id':'/';if(insertId)properties.$insert_id=insertId;
 // No browser SDK: no autocapture, session replay, page URL, title, form content, or referrer URL.
 try{const response=await fetch(`${process.env.POSTHOG_HOST||'https://us.i.posthog.com'}/i/v0/e/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:process.env.POSTHOG_KEY,event,properties}),signal:AbortSignal.timeout(4000)});return response.ok;}catch{return false;}
}
export const allowedBrowserEvent=event=>browserEvents.has(event);
