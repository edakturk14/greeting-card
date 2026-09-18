function uuid(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
function read(store,key){try{return window[store].getItem(key);}catch{return null;}}
function write(store,key,value){try{window[store].setItem(key,value);}catch{}}
const visitor=read('localStorage','als-visitor')||uuid();write('localStorage','als-visitor',visitor);
const sourceMap={'google.com':'google','bing.com':'bing','instagram.com':'instagram','facebook.com':'facebook','tiktok.com':'tiktok','x.com':'x','t.co':'x'};
function referral(){try{const host=new URL(document.referrer).hostname.replace(/^www\./,'');if(host===location.hostname)return 'internal';return sourceMap[host]||'other';}catch{return 'direct';}}
export class Analytics{
 constructor(config,recipient){this.active=config.analytics&&navigator.doNotTrack!=='1';this.visitor=visitor;const params=new URLSearchParams(location.search);const campaigns=config.campaigns||[];const clean=key=>{const v=params.get(key);return v?campaigns.includes(v)?v:'other':undefined;};this.context={page_type:recipient?'recipient':'landing',referral_source:referral(),utm_source:clean('utm_source'),utm_medium:clean('utm_medium'),utm_campaign:clean('utm_campaign'),from_recipient:!recipient&&read('sessionStorage','als-from-recipient')==='yes'};if(!recipient&&params.get('from')==='recipient'){this.context.from_recipient=true;write('sessionStorage','als-from-recipient','yes');}this.sent=new Set();}
 event(event,extra={},once=false){if(!this.active||once&&this.sent.has(event))return;this.sent.add(event);void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,eventId:uuid(),visitor:this.visitor,context:{...this.context,...extra}}),keepalive:true}).catch(()=>{});}
 creation(){return this.active?{visitor:this.visitor,context:this.context}:undefined;}
}
export const revealedOnDevice=id=>read('localStorage',`als-revealed:${id}`)==='yes';
export const rememberReveal=id=>write('localStorage',`als-revealed:${id}`,'yes');
