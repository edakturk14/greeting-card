import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {capture,cleanContext} from '../analytics.mjs';
import {PublicError} from '../storage.mjs';
import {videoConfig,BREAK_MESSAGE,MODELS} from './config.mjs';
import {FalProvider,measureAudio,validateVideo} from './fal.mjs';
import {SupabaseVideoStore} from './store.mjs';
const token=()=>randomBytes(24).toString('base64url');
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{32}$/.test(value);
const terminal=state=>['ready','failed','review'].includes(state);
export class VideoJobs{
 constructor({store=new SupabaseVideoStore(),provider=new FalProvider(),config=videoConfig,audioMeasure=measureAudio,videoMeasure=validateVideo}={}){Object.assign(this,{store,provider,config,audioMeasure,videoMeasure});}
 async change(job,patch){
  const updated=await this.store.cas(job,{...job,...patch,updated_at:new Date().toISOString()});
  if(updated&&['ready','failed'].includes(updated.state)&&updated.state!==job.state)await capture(updated.state==='ready'?'video_completed':'video_failed',updated.analytics?.visitor,updated.analytics?.context,new URL(updated.origin).host,updated.terminal_event_id);
  return updated;
 }
 async create(data,image,identity,origin){
  const c=this.config();if(!c.enabled)throw new PublicError(BREAK_MESSAGE,503);
  if(!opaque(data.resumeToken)||!/^[a-f0-9-]{36}$/.test(data.idempotencyKey||''))throw new PublicError('Reload and try again.',400);
  const message=typeof data.message==='string'?data.message.trim():'';
  if(!message||message.length>c.maxChars||message.split(/\s+/u).length>c.maxWords)throw new PublicError('Keep your message to 20 words and 200 characters.',400);
  const action=data.action===undefined?'':typeof data.action==='string'?data.action.trim():null;
  if(action===null||action.length>300||(data.action!==undefined&&!action))throw new PublicError('Describe one short action, up to 300 characters.',400);
  const to=typeof data.to==='string'?data.to.trim():'',from=typeof data.from==='string'?data.from.trim():'';
  if(!to||!from||to.length>60||from.length>60)throw new PublicError('Add both names (up to 60 characters each).',400);
  if(!image)throw new PublicError('Add one clear photo first.',400);
  const visitor=identity.visitorHash;
  const candidate={started_event_id:randomUUID(),terminal_event_id:randomUUID(),analytics:{visitor:/^[a-f0-9-]{36}$/.test(data.analytics?.visitor||'')?data.analytics.visitor:null,context:cleanContext(data.analytics?.context)},id:token(),share_id:token(),idempotency:hash(hash(data.resumeToken)+':'+data.idempotencyKey),fingerprint:hash(JSON.stringify({message,to,from,...(action?{action}:{}),image:hash(image)})),resume_hash:hash(data.resumeToken),visitor_hash:visitor,ip_hash:identity.ipHash,day:new Date().toISOString().slice(0,10),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),rev:0,state:'uploading',message,action,to,from,origin,voice:c.voice,charge_cents:c.reserveCents,reserved_cents:c.reserveCents,cost_state:'reserved',voice_nonce:token(),video_nonce:token(),voice_request:null,video_request:null,audio_key:null,video_key:null,error:null};
  let job=await this.store.reserve(candidate,c.caps);
  if(job.state==='uploading'){
   // Identical retries overwrite only their own validated input; no paid work yet.
   await this.store.putMedia(`${job.id}/photo.jpg`,image,'image/jpeg');
   job=await this.change(job,{state:'voice_ready',photo_key:`${job.id}/photo.jpg`})||await this.store.get(job.id);
  }
  return this.advance(job.id);
 }
 async authorize(id,resume){const job=opaque(id)?await this.store.get(id):null;const provided=hash(typeof resume==='string'?resume:'');if(!job||!timingSafeEqual(Buffer.from(job.resume_hash),Buffer.from(provided)))throw new PublicError('This private generation link could not be found.',404);return job;}
 view(job){return {id:job.id,state:job.state,message:job.message,action:job.action||'',to:job.to||'',from:job.from||'',error:job.error,photoUrl:`/api/video/jobs/${job.id}/photo`,shareUrl:job.state==='ready'?`${job.origin}/c/${job.share_id}`:null,videoUrl:job.state==='ready'?`/api/video/cards/${job.share_id}/media`:null,retryAllowed:['failed','ready'].includes(job.state),updatedAt:job.updated_at};}
 async submit(job,kind){
  let input;
  if(kind==='voice')input={text:job.message,voice:job.voice,stability:.5,similarity_boost:.75,speed:1};
  else input={image_url:await this.store.signMedia(job.photo_key),audio_url:await this.store.signMedia(job.audio_key),prompt:job.action||'.'};
  const claimed=await this.change(job,{state:`${kind}_submitting`,submission_started_at:new Date().toISOString()});
  if(!claimed)return this.store.get(job.id);
  try{
   const callback=`${job.origin}/api/video/webhook/${job.id}/${kind}/${job[kind+'_nonce']}`;
   const request=await this.provider.submit(kind,input,callback);
   // A callback may already have arrived. Never roll its completed state back.
   return await this.change(claimed,{state:`${kind}_pending`,next_poll_at:0,[kind+'_request']:request})||await this.store.get(job.id);
  }catch{
   // Acceptance is unknown: never resubmit. A signed callback can still recover this state.
   return await this.change(claimed,{error:'We’re checking this generation. Your photo and note are safe. Please check back; no extra generation will be started.',cost_state:'held_unknown'})||await this.store.get(job.id);
  }
 }
 async result(job,kind,result,requestId){
  if(![`${kind}_pending`,`${kind}_submitting`].includes(job.state))return job;
  if(job[kind+'_request']&&job[kind+'_request'].id!==requestId)throw new PublicError('Request mismatch.',400);
  if(result.error)return await this.change(job,{state:'failed',error:'This video could not be generated. You can edit your photo or note and try a new version.',cost_state:'held_unknown'})||await this.store.get(job.id);
  const reference=kind==='voice'?result.payload?.audio?.url:result.payload?.video?.url;
  if(typeof reference!=='string')return job;
  return await this.change(job,{state:kind==='voice'?'measuring':'saving',[kind+'_output']:reference,[kind+'_completed_id']:requestId,error:null})||await this.store.get(job.id);
 }
 async advance(id){
  let job=await this.store.get(id);if(!job||terminal(job.state))return job;
  if(['voice_ready','audio_ready'].includes(job.state))return this.submit(job,job.state==='voice_ready'?'voice':'video');
  if(['voice_pending','video_pending'].includes(job.state)){
   const kind=job.state.startsWith('voice')?'voice':'video';
   const nextPoll=Date.now()+4000;if(job.next_poll_at>Date.now())return job;
   const claimed=await this.change(job,{next_poll_at:nextPoll});if(!claimed)return this.store.get(id);
   try{const result=await this.provider.poll(claimed[kind+'_request']);if(result)return this.result(claimed,kind,result,claimed[kind+'_request'].id);}catch{/* Preserve paid request ID for later recovery. */}
   return claimed;
  }
  if(['voice_submitting','video_submitting'].includes(job.state))return job; // Deliberately no paid retry.
  if(['measuring','saving'].includes(job.state)){
   if(job.import_until>Date.now())return job;
   const claimed=await this.change(job,{import_until:Date.now()+45000});if(!claimed)return this.store.get(id);job=claimed;
   try{
    if(job.state==='measuring'){
     const bytes=await this.provider.download(job.voice_output,4*1024*1024);const seconds=await this.audioMeasure(bytes);
     const speechCents=Math.ceil(job.message.length*.01);
     if(seconds>10)return await this.change(job,{state:'failed',error:'That message takes more than 10 seconds to say. Please shorten it and generate a new version.',charge_cents:speechCents,cost_state:'speech_only',audio_seconds:seconds,import_until:0})||await this.store.get(id);
     await this.store.putMedia(`${id}/speech.mp3`,bytes,'audio/mpeg');
     return await this.change(job,{state:'audio_ready',audio_key:`${id}/speech.mp3`,audio_seconds:seconds,estimated_cents:speechCents+Math.ceil(Math.ceil(seconds)*5.62),import_until:0})||await this.store.get(id);
    }
    const bytes=await this.provider.download(job.video_output,30*1024*1024);const seconds=await this.videoMeasure(bytes);
    await this.store.putMedia(`${id}/video.mp4`,bytes,'video/mp4');
    // Verify our own durable copy exists before making the share link usable.
    const stored=await this.store.readMedia(`${id}/video.mp4`);if(hash(stored)!==hash(bytes))throw Error('Storage verification failed');
    return await this.change(job,{state:'ready',video_key:`${id}/video.mp4`,video_seconds:seconds,cost_state:'committed_ceiling',import_until:0,error:null})||await this.store.get(id);
   }catch{
    return await this.change(job,{import_until:0,import_failures:(job.import_failures||0)+1,...((job.import_failures||0)>=2?{state:'review',cost_state:'held_unknown'}:{}),error:(job.import_failures||0)>=2?'This video needs a storage or media check. Its budget is held; no replacement will be generated automatically.':'We couldn’t finish saving the media yet. Use Check again to resume this job; it will not generate another video.'})||await this.store.get(id);
   }
  }
  return job;
 }
 async webhook(id,kind,nonce,result,requestId){
  let job=opaque(id)?await this.store.get(id):null;
  if(!job||!['voice','video'].includes(kind)||nonce!==job[kind+'_nonce'])throw new PublicError('Webhook not found.',404);
  job=await this.result(job,kind,result,requestId);
  // One bounded, awaited transition. No detached tasks after the response.
  job=await this.advance(job.id);
  if(job?.state==='audio_ready')job=await this.advance(job.id);
  return job;
 }
 async cleanupAbandoned(){let count=0;for(const job of await this.store.pending()){if(job.state==='uploading'&&Date.now()-Date.parse(job.created_at)>3600000){await this.store.deleteMedia(`${job.id}/photo.jpg`);await this.change(job,{state:'failed',charge_cents:0,cost_state:'not_submitted',error:'The upload was interrupted. Please add your photo again.'});count++;}}return count;}
 async card(id){const job=opaque(id)?await this.store.byShare(id):null;if(!job)throw new PublicError('This card could not be found.',404);return {type:'video',cover:job.to?`This one’s for you, ${job.to}.`:'This one’s for you.',message:job.message,action:job.action||'',to:job.to||'',from:job.from||'',color:'silver',photo:null,video:`/api/video/cards/${id}/media`,createdAt:job.created_at};}
 async playbackUrl(id,download=false){if(!this.store.playbackUrl)return null;const job=opaque(id)?await this.store.byShare(id):null;if(!job)throw new PublicError('This card could not be found.',404);return this.store.playbackUrl(job.video_key,download);}
 async media(id){const job=opaque(id)?await this.store.byShare(id):null;if(!job)throw new PublicError('This card could not be found.',404);return this.store.readMedia(job.video_key);}
}
export let videoJobs=new VideoJobs();
export function setVideoJobsForTests(jobs){if(process.env.NODE_ENV!=='test')throw Error('Test injection only');videoJobs=jobs;}
