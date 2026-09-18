import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {videoJobs,hash,opaque} from './jobs.mjs';
import {falKeys,verifyWebhook} from './fal.mjs';
import {PublicError} from '../storage.mjs';
import {baseUrl} from '../metadata.mjs';
import {capture} from '../analytics.mjs';
function visitor(req,res){
 const secret=process.env.APP_SECRET;if(!secret||secret.length<32)throw new PublicError('Video generation is not available yet.',503);
 const sign=id=>createHmac('sha256',secret).update('video-visitor:'+id).digest('hex');
 const cookie=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('fig-video-visitor='))?.slice(18)||'';
 const [id,sig]=cookie.split('.');if(opaque(id)&&sig?.length===64&&timingSafeEqual(Buffer.from(sig),Buffer.from(sign(id))))return hash(id);
 const next=randomBytes(24).toString('base64url');res.setHeader('Set-Cookie',`fig-video-visitor=${next}.${sign(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.APP_ENV==='production'?'; Secure':''}`);return hash(next);
}
export async function rawBody(req,max){let n=0;const chunks=[];for await(const chunk of req){n+=chunk.length;if(n>max)throw new PublicError('Request too large.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
export async function videoRoute(req,res,url,{json,body,sameOrigin,ipHash,cleanPhoto,fastLimit}){
 if(!url.pathname.startsWith('/api/video/'))return false;
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Cache-Control','no-store');
 const authorization=()=>String(req.headers.authorization||'').replace(/^Bearer /,'');
 if(url.pathname==='/api/video/jobs'&&req.method==='POST'){
  sameOrigin(req);fastLimit(req,'video-start',20);const data=await body(req,2900000);
  if(!videoJobs.config().enabled)throw new PublicError('Video cards are taking a little break. You can still send a scratch card.',503);
  const image=await cleanPhoto(data.photo);const job=await videoJobs.create(data,image,{visitorHash:visitor(req,res),ipHash:ipHash(req)},baseUrl(req));
  await capture('video_started',data.analytics?.visitor,data.analytics?.context,req.headers.host,job.started_event_id);
  json(res,202,videoJobs.view(job));return true;
 }
 const jobRoute=url.pathname.match(/^\/api\/video\/jobs\/([A-Za-z0-9_-]{32})(?:\/(advance|photo))?$/);
 if(jobRoute){
  fastLimit(req,'video-status',900);let job=await videoJobs.authorize(jobRoute[1],authorization());
  if(jobRoute[2]==='advance'&&req.method==='POST'){sameOrigin(req);job=await videoJobs.advance(job.id);json(res,200,videoJobs.view(job));return true;}
  if(req.method==='GET'&&jobRoute[2]==='photo'){if(!job.photo_key)throw new PublicError('Photo not ready.',404);res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(await videoJobs.store.readMedia(job.photo_key));return true;}
  if(req.method==='GET'&&!jobRoute[2]){json(res,200,videoJobs.view(job));return true;}
  throw new PublicError('Method not allowed.',405);
 }
 const callback=url.pathname.match(/^\/api\/video\/webhook\/([A-Za-z0-9_-]{32})\/(voice|video)\/([A-Za-z0-9_-]{32})$/);
 if(callback&&req.method==='POST'){
  const raw=await rawBody(req,1024*1024);const keys=await falKeys();
  if(!verifyWebhook(raw,req.headers,keys,process.env.FAL_WEBHOOK_USER_ID))throw new PublicError('Invalid webhook signature.',401);
  let data;try{data=JSON.parse(raw);}catch{throw new PublicError('Invalid webhook.',400);}
  const requestId=req.headers['x-fal-webhook-request-id'];if(data.request_id!==requestId||!['OK','ERROR'].includes(data.status))throw new PublicError('Invalid webhook request.',400);
  await videoJobs.webhook(callback[1],callback[2],callback[3],{error:data.status==='ERROR',payload:data.payload},requestId);json(res,200,{accepted:true});return true;
 }
 const media=url.pathname.match(/^\/api\/video\/cards\/([A-Za-z0-9_-]{32})\/media$/);
 if(media&&['GET','HEAD'].includes(req.method)){
  fastLimit(req,'video-media',180);const location=await videoJobs.playbackUrl(media[1],url.searchParams.has('download'));if(location){res.writeHead(307,{Location:location,'Cache-Control':'no-store'});res.end();return true;}const bytes=await videoJobs.media(media[1]);const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','Content-Disposition':url.searchParams.has('download')?'attachment; filename="SendFiggle.mp4"':'inline'};
  const range=req.headers.range;
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=bytes.length-1;if(!match||!match[1]&&!match[2]){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return true;}
   if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}else start=Math.max(0,bytes.length-Number(match[2]));
   if(start>end||start>=bytes.length){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return true;}
   res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));return true;
  }
  res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);return true;
 }
 throw new PublicError('Not found.',404);
}
