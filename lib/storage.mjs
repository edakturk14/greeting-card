import {mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {localTesting} from './local-testing.mjs';
import {randomBytes} from 'node:crypto';
const dir=path.resolve(process.env.DATA_DIR||'data');
export const cloud=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
const bucket='card-photos';
export class PublicError extends Error{constructor(message,status=400){super(message);this.status=status;}}
function requireStorage(){if((process.env.VERCEL||process.env.APP_ENV==='production')&&!cloud)throw new PublicError('The card studio is being set up. Please come back soon.',503);}
export function storageReady(){return !(process.env.VERCEL||process.env.APP_ENV==='production')||cloud;}
async function sb(route,options={}){
 const result=await fetch(`${process.env.SUPABASE_URL.replace(/\/$/,'')}${route}`,{...options,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, ...options.headers},signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw new PublicError('The card studio is unavailable. Please try again shortly.',503);
 if(result.status===204)return null;
 return result;
}
const writeJson=async(name,value)=>{await mkdir(dir,{recursive:true,mode:0o700});const temp=path.join(dir,`${name}.${randomBytes(6).toString('hex')}.tmp`);await writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});await rename(temp,path.join(dir,name));};
let localLock=Promise.resolve();
function locked(fn){const next=localLock.then(fn,fn);localLock=next.catch(()=>{});return next;}
// Conservative reservation: failed attempts count too. Durable atomic SQL in production.
export async function reserveCreation(ip){
 requireStorage();
 if(localTesting())return;
 if(cloud){const response=await sb('/rest/v1/rpc/reserve_card',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip_hash:ip})});if(!await response.json())throw new PublicError('This little studio has reached its limit. Please try again later.',429);return;}
 await locked(async()=>{
 let counters={};try{counters=JSON.parse(await readFile(path.join(dir,'limits.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const hour=new Date().toISOString().slice(0,13),day=hour.slice(0,10);
 const keys=[`h:${ip}:${hour}`,`d:${ip}:${day}`,`global:${day}`,'lifetime'];const caps=[5,20,50,1000];
 if(keys.some((key,i)=>(counters[key]||0)>=caps[i]))throw new PublicError('This little studio has reached its limit. Please try again later.',429);
 for(const key of keys)counters[key]=(counters[key]||0)+1;
 counters=Object.fromEntries(Object.entries(counters).filter(([k])=>k==='lifetime'||k.endsWith(day)||k.endsWith(hour)));
 await writeJson('limits.json',counters);
 });
}
export async function saveCard(card,image){
 requireStorage();const id=randomBytes(24).toString('base64url');const photo=image?`${id}.jpg`:null;
 const row={id,to_name:card.to,cover:card.cover,message:card.message,from_name:card.from,color:card.color,photo,created_at:new Date().toISOString(),status:'pending'};
 if(cloud){
 await sb('/rest/v1/cards',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)});
 try{
  if(image)await sb(`/storage/v1/object/${bucket}/${photo}`,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:image});
  await sb(`/rest/v1/cards?id=eq.${id}&status=eq.pending`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:'ready'})});
 }catch(error){
  // A final PATCH can time out after committing. Never delete a possibly ready card here.
  // Pending rows are reclaimed by cleanup after one hour (well beyond request timeouts).
  throw error;
 }
 }else{
 await writeJson(`${id}.json`,row);
 if(image){await mkdir(path.join(dir,'images'),{recursive:true,mode:0o700});await writeFile(path.join(dir,'images',photo),image,{flag:'wx',mode:0o600});}
 row.status='ready';await writeJson(`${id}.json`,row);
 }
 return id;
}
export async function getCard(id){
 requireStorage();let row;
 if(cloud){const response=await sb(`/rest/v1/cards?id=eq.${id}&status=eq.ready&select=*&limit=1`);row=(await response.json())[0];}
 else{try{row=JSON.parse(await readFile(path.join(dir,`${id}.json`),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
 if(!row||(row.status&&row.status!=='ready'))throw new PublicError('This card could not be found. Check that you have the complete link.',404);
 // Preserve links created by the previous plain-card version.
 return {to:row.to_name??row.to??'',cover:row.cover||row.greeting,message:row.message,from:row.from_name??row.from??'',color:row.color||'silver',photo:row.photo?`/api/cards/${id}/photo`:null,createdAt:row.created_at||row.createdAt};
}
export async function getPhoto(id){
 const card=await getCard(id);if(!card.photo)throw new PublicError('This card has no photo.',404);
 if(cloud){const response=await sb(`/storage/v1/object/authenticated/${bucket}/${id}.jpg`);return Buffer.from(await response.arrayBuffer());}
 return readFile(path.join(dir,'images',`${id}.jpg`));
}
export async function cleanup(){
 requireStorage();const before=new Date(Date.now()-3600000).toISOString();let removed=0;
 if(cloud){
 // Claim only old pending records. The creator cannot still be executing after an hour.
 const response=await sb(`/rest/v1/cards?status=in.(pending,deleting)&created_at=lt.${before}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({status:'deleting'})});
 const rows=await response.json();
 for(const row of rows){if(row.photo)await sb(`/storage/v1/object/${bucket}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[row.photo]})});await sb(`/rest/v1/cards?id=eq.${row.id}&status=eq.deleting`,{method:'DELETE'});removed++;}
 }else{
 await mkdir(dir,{recursive:true,mode:0o700});
 for(const file of await readdir(dir)){
  if(!/^[A-Za-z0-9_-]{32}\.json$/.test(file))continue;
  const row=JSON.parse(await readFile(path.join(dir,file),'utf8'));
  if(row.status==='pending'&&row.created_at<before){if(row.photo)await unlink(path.join(dir,'images',row.photo)).catch(e=>{if(e.code!=='ENOENT')throw e;});await unlink(path.join(dir,file));removed++;}
 }
 }
 return removed;
}
