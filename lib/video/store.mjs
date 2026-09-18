import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {PublicError} from '../storage.mjs';
import {BREAK_MESSAGE} from './config.mjs';
export class SupabaseVideoStore{
 async request(route,options={}){
  const r=await fetch(`${process.env.SUPABASE_URL}${route}`,{...options,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,...options.headers},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new PublicError('Video storage is taking a moment. Your job can be resumed.',503);return r;
 }
 async rpc(name,args){return (await this.request(`/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)})).json();}
 async reserve(job,caps){const result=await this.rpc('reserve_video_job',{candidate:job,caps});if(result.error==='limit')throw new PublicError(BREAK_MESSAGE,429);if(result.error)throw new PublicError('This request belongs to a different draft. Start a new version.',409);return result;}
 async get(id){if(!process.env.SUPABASE_URL)return null;const rows=await(await this.request(`/rest/v1/video_jobs?id=eq.${id}&select=doc`)).json();return rows[0]?.doc||null;}
 async byShare(id){if(!process.env.SUPABASE_URL)return null;const rows=await(await this.request(`/rest/v1/video_jobs?share_id=eq.${id}&state=eq.ready&select=doc`)).json();return rows[0]?.doc||null;}
 async cas(job,next){return this.rpc('update_video_job',{job_id:job.id,expected_rev:job.rev,next_doc:{...next,rev:job.rev+1}});}
 async pending(){if(!process.env.SUPABASE_URL)return [];return (await(await this.request('/rest/v1/video_jobs?state=not.in.(ready,failed,review)&select=doc&order=updated_at.asc&limit=8')).json()).map(r=>r.doc);}
 async putMedia(key,bytes,type){await this.request(`/storage/v1/object/video-media/${key}`,{method:'POST',headers:{'Content-Type':type,'x-upsert':'true'},body:bytes});}
 async readMedia(key){const r=await this.request(`/storage/v1/object/authenticated/video-media/${key}`);return Buffer.from(await r.arrayBuffer());}
 async deleteMedia(key){await this.request('/storage/v1/object/video-media',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});}
 async playbackUrl(key,download=false){const url=new URL(await this.signMedia(key));if(download)url.searchParams.set('download','SendFiggle.mp4');return url.href;}
 async signMedia(key){const result=await(await this.request(`/storage/v1/object/sign/video-media/${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:86400})})).json();return new URL(`/storage/v1${result.signedURL}`,process.env.SUPABASE_URL).href;}
}
// Durable file adapter for isolated tests. Production generation always requires Supabase.
export class FileVideoStore{
 constructor(dir){this.dir=dir;this.lock=Promise.resolve();}
 async read(){try{return JSON.parse(await readFile(path.join(this.dir,'jobs.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 transaction(fn){const action=this.lock.then(async()=>{const data=await this.read();const out=fn(data);await mkdir(this.dir,{recursive:true});const tmp=path.join(this.dir,randomBytes(8).toString('hex')+'.tmp');await writeFile(tmp,JSON.stringify(data),{mode:0o600});await rename(tmp,path.join(this.dir,'jobs.json'));return structuredClone(out);});this.lock=action.catch(()=>{});return action;}
 async reserve(job,caps){return this.transaction(data=>{
  const all=Object.values(data),existing=all.find(j=>j.idempotency===job.idempotency);
  if(existing){if(existing.fingerprint!==job.fingerprint||existing.resume_hash!==job.resume_hash)throw new PublicError('This request belongs to a different draft.',409);return existing;}
  const today=all.filter(j=>j.day===job.day),sum=a=>a.reduce((n,j)=>n+j.charge_cents,0);
  if(today.filter(j=>j.visitor_hash===job.visitor_hash).length>=caps.visitor||today.filter(j=>j.ip_hash===job.ip_hash).length>=caps.ip||today.length>=caps.daily||all.filter(j=>!['ready','failed','review'].includes(j.state)).length>=caps.inflight||sum(today)+job.charge_cents>caps.dailyCents||sum(all)+job.charge_cents>caps.totalCents)throw new PublicError(BREAK_MESSAGE,429);
  data[job.id]=job;return job;
 });}
 async get(id){return (await this.read())[id]||null;}
 async byShare(id){return Object.values(await this.read()).find(j=>j.share_id===id&&j.state==='ready')||null;}
 async cas(job,next){return this.transaction(data=>{if(data[job.id]?.rev!==job.rev)return null;const result={...next,rev:job.rev+1};data[job.id]=result;return result;});}
 async pending(){return Object.values(await this.read()).filter(j=>!['ready','failed','review'].includes(j.state)).slice(0,8);}
 async putMedia(key,bytes){const file=path.join(this.dir,'media',key);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
 async readMedia(key){return readFile(path.join(this.dir,'media',key));}
 async deleteMedia(key){await unlink(path.join(this.dir,'media',key)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 async signMedia(key){return `https://media.test/${key}`;}
}
