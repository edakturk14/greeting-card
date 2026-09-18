import {createHash,createPublicKey,verify} from 'node:crypto';
import {parseBuffer} from 'music-metadata';
import {MODELS} from './config.mjs';
const queue='https://queue.fal.run/';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);
export function queueUrl(url){const u=new URL(url);if(u.origin!=='https://queue.fal.run'||u.username||u.password||u.hash)throw Error('Invalid queue URL');return u.href;}
export class FalProvider{
 async submit(kind,input,callback){
  const url=new URL(queue+MODELS[kind]);url.searchParams.set('fal_webhook',callback);
  // No transport or model retry: an ambiguous acceptance must be reconciled, not resubmitted.
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Key ${process.env.FAL_KEY}`,'Content-Type':'application/json','X-Fal-No-Retry':'1'},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Provider submission could not be confirmed');const data=await r.json();
  if(!validId(data.request_id))throw Error('Invalid request ID');
  const root=queue+MODELS[kind].split('/').slice(0,2).join('/')+'/requests/'+data.request_id;
  return {id:data.request_id,status:queueUrl(data.status_url||root+'/status'),result:queueUrl(data.response_url||root)};
 }
 async poll(request){
  const options={headers:{Authorization:`Key ${process.env.FAL_KEY}`},signal:AbortSignal.timeout(10000)};
  const r=await fetch(queueUrl(request.status),options);if(!r.ok)throw Error('Status temporarily unavailable');const status=await r.json();
  if(status.status!=='COMPLETED')return null;
  if(status.error)return {error:true};const result=await fetch(queueUrl(request.result),options);
  if([400,422].includes(result.status))return {error:true};if(!result.ok)throw Error('Result temporarily unavailable');return {payload:await result.json()};
 }
 async download(url,maxBytes){
  const u=new URL(url);if(u.protocol!=='https:'||!(u.hostname==='fal.media'||u.hostname.endsWith('.fal.media'))||u.username||u.password)throw Error('Unexpected provider media host');
  const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok||Number(r.headers.get('content-length'))>maxBytes)throw Error('Media unavailable or too large');
  const chunks=[];let n=0;for await(const chunk of r.body){n+=chunk.length;if(n>maxBytes)throw Error('Media too large');chunks.push(chunk);}return Buffer.concat(chunks);
 }
}
export async function measureAudio(bytes){const m=await parseBuffer(bytes,undefined,{duration:true});const seconds=m.format.duration;if(!Number.isFinite(seconds)||seconds<=0||!m.format.numberOfChannels)throw Error('Could not measure speech');return seconds;}
// Read ISO BMFF track handlers, not file extensions: require both real audio and video tracks.
export function mp4Tracks(bytes){
 const tracks=new Set();function walk(start,end,depth=0){if(depth>8)return;for(let pos=start;pos+8<=end;){let size=bytes.readUInt32BE(pos),header=8;const type=bytes.toString('ascii',pos+4,pos+8);if(size===1){if(pos+16>end)return;size=Number(bytes.readBigUInt64BE(pos+8));header=16;}if(size===0)size=end-pos;if(size<header||pos+size>end)return;if(type==='hdlr'&&size>=header+12)tracks.add(bytes.toString('ascii',pos+header+8,pos+header+12));if(['moov','trak','mdia'].includes(type))walk(pos+header,pos+size,depth+1);pos+=size;}}
 walk(0,bytes.length);return tracks;
}
export async function validateVideo(bytes){if(bytes.length<16||bytes.toString('ascii',4,8)!=='ftyp')throw Error('Expected MP4');const tracks=mp4Tracks(bytes);if(!tracks.has('soun')||!tracks.has('vide'))throw Error('Video must include picture and sound');const seconds=await measureAudio(bytes);if(seconds>10)throw Error('Video is longer than ten seconds');return seconds;}
let jwks,keysAt=0;
export async function falKeys(){if(!jwks||Date.now()-keysAt>3600000){const r=await fetch('https://rest.fal.ai/.well-known/jwks.json',{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Could not verify webhook');jwks=(await r.json()).keys;keysAt=Date.now();}return jwks;}
export function verifyWebhook(raw,headers,keys,expectedUser,now=Date.now()){
 const id=headers['x-fal-webhook-request-id'],user=headers['x-fal-webhook-user-id'],time=headers['x-fal-webhook-timestamp'],signature=headers['x-fal-webhook-signature'];
 if(!validId(id)||!expectedUser||user!==expectedUser||typeof time!=='string'||!/^\d+$/.test(time)||Math.abs(now/1000-Number(time))>300||typeof signature!=='string'||! /^[a-f0-9]{128}$/i.test(signature))return false;
 const message=Buffer.from([id,user,time,createHash('sha256').update(raw).digest('hex')].join('\n'));
 return keys.some(key=>{try{return key.kty==='OKP'&&key.crv==='Ed25519'&&verify(null,message,createPublicKey({key,format:'jwk'}),Buffer.from(signature,'hex'));}catch{return false;}});
}
