import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {randomBytes,randomUUID,generateKeyPairSync,sign,createHash} from 'node:crypto';
import {VideoJobs} from '../lib/video/jobs.mjs';
import {FileVideoStore} from '../lib/video/store.mjs';
import {verifyWebhook,measureAudio,validateVideo} from '../lib/video/fal.mjs';
import {videoConfig} from '../lib/video/config.mjs';
const audio=await readFile(new URL('./fixtures/speech-fixture.mp3',import.meta.url)),video=await readFile(new URL('./fixtures/video-with-audio.mp4',import.meta.url));
const token=()=>randomBytes(24).toString('base64url');
const config=()=>({enabled:true,configured:true,maxChars:200,maxWords:20,maxSeconds:10,reserveCents:65,voice:'Rachel',caps:{visitor:2,ip:3,daily:4,inflight:2,dailyCents:200,totalCents:300}});
class Provider{
 constructor(){this.calls=[];this.expired=false;}
 async submit(kind,input,callback){this.calls.push({kind,input,callback});if(this.uncertain)throw Error('timeout after acceptance');return {id:kind+'-request-1234',status:'https://queue.fal.run/status',result:'https://queue.fal.run/result'};}
 async poll(request){return this.failure?{error:true}:{payload:request.id.startsWith('voice')?{audio:{url:'https://v3.fal.media/audio.mp3'}}:{video:{url:'https://v3.fal.media/video.mp4'}}};}
 async download(url){if(this.expired)throw Error('expired');return url.endsWith('.mp3')?audio:video;}
}
async function setup(t,overrides={}){const dir=await mkdtemp(path.join(os.tmpdir(),'fig-video-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new FileVideoStore(dir),provider=new Provider();const service=new VideoJobs({store,provider,config,...overrides});const input={to:'Maya',from:'Eda',message:'Happy birthday! Sending a hug.',idempotencyKey:randomUUID(),resumeToken:token()};const identity={visitorHash:'v1',ipHash:'ip1'};return {dir,store,provider,service,input,identity};}
async function ready(service,id){for(let i=0;i<12;i++){const j=await service.advance(id);if(j.state==='ready'||j.state==='failed')return j;}throw Error('Did not complete');}
test('required names reject blank requests before any paid work',async t=>{
 const {service,store,provider,input,identity}=await setup(t);
 for(const key of ['to','from'])for(const value of ['', '   ', undefined])await assert.rejects(service.create({...input,[key]:value},Buffer.from('photo'),identity,'https://cards.test'),{status:400});
 assert.equal(provider.calls.length,0);assert.equal(Object.keys(await store.read()).length,0);
});
test('durable stages, concurrent duplicate submissions and refresh never duplicate paid work',async t=>{
 const {service,store,provider,input,identity,dir}=await setup(t);const image=Buffer.from('validated image');
 const jobs=await Promise.all(Array.from({length:5},()=>service.create(input,image,identity,'https://cards.test')));assert.equal(new Set(jobs.map(j=>j.id)).size,1);assert.equal(provider.calls.length,1);
 const recovered=new VideoJobs({store:new FileVideoStore(dir),provider,config});let job=await ready(recovered,jobs[0].id);assert.equal(job.state,'ready');assert.deepEqual(provider.calls.map(c=>c.kind),['voice','video']);assert.equal(provider.calls[0].input.voice,'Rachel');assert.ok(provider.calls[1].input.audio_url.startsWith('https://media.test/'));assert.equal(job.cost_state,'committed_ceiling');assert.equal(job.charge_cents,65);
 await recovered.create(input,image,identity,'https://cards.test');assert.equal(provider.calls.length,2);
 provider.expired=true;assert.deepEqual(await recovered.media(job.share_id),video);assert.equal((await recovered.card(job.share_id)).type,'video');await assert.rejects(recovered.authorize(job.id,job.share_id),{status:404});await assert.rejects(recovered.card(job.id),{status:404});assert.equal((await recovered.authorize(job.id,input.resumeToken)).id,job.id);
 const oldRev=job.rev;await recovered.webhook(job.id,'video',job.video_nonce,{payload:{video:{url:'https://v3.fal.media/video.mp4'}}},'video-request-1234');assert.equal((await store.get(job.id)).rev,oldRev);
});
test('concurrent cost reservations enforce visitor, IP, daily, total and inflight caps without LOCAL_TEST_MODE bypass',async t=>{
 const limits=[{visitor:1},{ip:1},{daily:1},{dailyCents:65},{totalCents:65},{inflight:1}];
 for(const cap of limits){const {service,store,input,identity}=await setup(t,{config:()=>({...config(),caps:{...config().caps,...cap}})});const previous=process.env.LOCAL_TEST_MODE;process.env.LOCAL_TEST_MODE='1';try{const results=await Promise.allSettled([service.create(input,Buffer.from('photo'),identity,'https://cards.test'),service.create({...input,resumeToken:token(),idempotencyKey:randomUUID()},Buffer.from('photo'),identity,'https://cards.test')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1,JSON.stringify(cap));assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===429).length,1);assert.equal(Object.values(await store.read()).length,1);}finally{if(previous===undefined)delete process.env.LOCAL_TEST_MODE;else process.env.LOCAL_TEST_MODE=previous;}}
});
test('uncertain submit holds its reservation, never retries and can recover from a signed callback',async t=>{
 const {service,provider,store,input,identity}=await setup(t);provider.uncertain=true;let job=await service.create(input,Buffer.from('photo'),identity,'https://cards.test');assert.equal(job.state,'voice_submitting');assert.equal(job.cost_state,'held_unknown');for(let i=0;i<3;i++)await service.advance(job.id);assert.equal(provider.calls.length,1);assert.equal((await store.get(job.id)).charge_cents,65);provider.uncertain=false;job=await service.webhook(job.id,'voice',job.voice_nonce,{payload:{audio:{url:'https://v3.fal.media/audio.mp3'}}},'voice-request-1234');assert.equal(job.state,'video_pending');assert.equal(provider.calls.length,2);await assert.rejects(service.webhook(job.id,'video','incorrect',{error:true},'video-request-1234'),{status:404});
});
test('overlong speech stops before video submission; failures keep draft and uncertain costs',async t=>{
 const x=await setup(t,{audioMeasure:async()=>10.01});let j=await x.service.create(x.input,Buffer.from('photo'),x.identity,'https://cards.test');j=await ready(x.service,j.id);assert.equal(j.state,'failed');assert.match(j.error,/shorten/);assert.equal(x.provider.calls.length,1);assert.equal(j.message,x.input.message);assert.equal(j.cost_state,'speech_only');assert.ok(j.charge_cents<65);
 const y=await setup(t);y.provider.failure=true;j=await y.service.create(y.input,Buffer.from('photo'),y.identity,'https://cards.test');j=await y.service.advance(j.id);assert.equal(j.state,'failed');assert.equal(j.charge_cents,65);assert.equal(j.cost_state,'held_unknown');
});
test('generation kill switch preserves existing recipient playback',async t=>{
 let enabled=true;const x=await setup(t,{config:()=>({...config(),enabled})});const initial=await x.service.create(x.input,Buffer.from('photo'),x.identity,'https://cards.test');const complete=await ready(x.service,initial.id);enabled=false;await assert.rejects(x.service.create({...x.input,idempotencyKey:randomUUID()},Buffer.from('photo'),x.identity,'https://cards.test'),{status:503});assert.deepEqual(await x.service.media(complete.share_id),video);
});
test('Ed25519 webhook verification binds raw bytes, timestamp, user and request',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');const keys=[publicKey.export({format:'jwk'})];const raw=Buffer.from('{"status":"OK"}'),time=String(Math.floor(Date.now()/1000));const headers={'x-fal-webhook-request-id':'request-123456','x-fal-webhook-user-id':'user-123','x-fal-webhook-timestamp':time};const message=Buffer.from([headers['x-fal-webhook-request-id'],'user-123',time,createHash('sha256').update(raw).digest('hex')].join('\n'));headers['x-fal-webhook-signature']=sign(null,message,privateKey).toString('hex');assert.equal(verifyWebhook(raw,headers,keys,'user-123'),true);assert.equal(verifyWebhook(Buffer.from('{}'),headers,keys,'user-123'),false);assert.equal(verifyWebhook(raw,headers,keys,'other'),false);assert.equal(verifyWebhook(raw,headers,keys,'user-123',Date.now()+400000),false);assert.equal(verifyWebhook(raw,{...headers,'x-fal-webhook-request-id':'other-123456'},keys,'user-123'),false);
});
test('actual fixture metadata includes sound and picture; missing credentials do not expose a mock',async()=>{assert.ok(await measureAudio(audio)>1);assert.ok(await validateVideo(video)>1);await assert.rejects(validateVideo(audio));assert.equal(videoConfig().mocked,false);});

test('hosted playback signs only completed recipient media without buffering the MP4',async()=>{
 const id=token();let reads=0;
 const service=new VideoJobs({store:{byShare:async key=>key===id?{video_key:'saved/result.mp4'}:null,playbackUrl:async(key,download)=>{assert.equal(key,'saved/result.mp4');assert.equal(download,true);return 'https://storage.example/signed-result';},readMedia:async()=>{reads++;}},config});
 assert.equal(await service.playbackUrl(id,true),'https://storage.example/signed-result');assert.equal(reads,0);await assert.rejects(service.playbackUrl(token()),{status:404});
});

test('action instructions persist, reach only animation, and distinguish paid attempts',async t=>{
 const {service,store,provider,input,identity}=await setup(t);input.action='Smile warmly and give a small, friendly wave.';
 const job=await service.create(input,Buffer.from('photo'),identity,'https://cards.test');await ready(service,job.id);
 assert.equal((await store.get(job.id)).action,input.action);assert.equal(service.view(await store.get(job.id)).action,input.action);
 assert.equal(provider.calls[0].input.text,input.message);assert.equal(provider.calls[1].input.prompt,input.action);
 await assert.rejects(service.create({...input,action:'Blow a kiss.'},Buffer.from('photo'),identity,'https://cards.test'));
 for(const action of ['', ' '.repeat(4), 'a'.repeat(301), {}])await assert.rejects(service.create({...input,action},Buffer.from('photo'),identity,'https://cards.test'),{status:400});
 assert.equal(provider.calls.length,2);
});
