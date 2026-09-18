import {readFile} from 'node:fs/promises';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {baseUrl,metadata} from './metadata.mjs';
export {baseUrl} from './metadata.mjs';
import sharp from 'sharp';
import {videoRoute} from './video/routes.mjs';
import {videoJobs} from './video/jobs.mjs';
import {publicVideoConfig} from './video/config.mjs';
import {localTesting} from './local-testing.mjs';
import {cloud,storageReady,reserveCreation,saveCard,getCard,getPhoto,cleanup,PublicError} from './storage.mjs';
import {enabled,capture,allowedBrowserEvent,cleanContext} from './analytics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const idPattern='[A-Za-z0-9_-]{24,32}';
const clientLimits=new Map();
const port=Number(process.env.PORT||3001);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function sameOrigin(req){try{if(new URL(req.headers.origin).host===req.headers.host)return;}catch{}throw new PublicError('Please use this website to create your card.',403);}
function ip(req){const address=process.env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;return String(address||'unknown').split(',')[0].trim();}
function ipHash(req){return createHmac('sha256',process.env.APP_SECRET||'local-development-only').update(ip(req)).digest('hex');}
function fastLimit(req,group,max){const key=`${group}:${ipHash(req)}`;const now=Date.now();if(clientLimits.size>10000)for(const [k,v]of clientLimits)if(v.until<now)clientLimits.delete(k);let item=clientLimits.get(key);if(!item||item.until<now)item={count:0,until:now+3600000};if(++item.count>max)throw new PublicError('Please slow down and try again later.',429);clientLimits.set(key,item);}
async function body(req,max){if(Number(req.headers['content-length'])>max)throw new PublicError('Please use a photo under 2 MB.',413);const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max)throw new PublicError('This upload is too large.',413);chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks));}catch{throw new PublicError('We couldn’t read your card. Please try again.');}}
function validate(data){data={...data,to:data?.to??'',from:data?.from??''};const result={};for(const [key,max]of Object.entries({to:60,cover:100,message:1200,from:60})){if(typeof data?.[key]!=='string'||!data[key].trim()||data[key].trim().length>max)throw new PublicError(`Please enter ${key==='to'?'a recipient':key==='from'?'your name':key==='cover'?'cover text':'a message'} (up to ${max} characters).`);result[key]=data[key].trim();}if(!['silver','pink','gold'].includes(data.color))throw new PublicError('Choose silver, pink or gold.');result.color=data.color;return result;}
export async function cleanPhoto(raw){if(raw==null||raw==='')return null;if(typeof raw!=='string')throw new PublicError('Choose a JPG, PNG or WEBP photo.');const match=raw.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw new PublicError('Choose a JPG, PNG or WEBP photo. SVG, GIF and HEIC are not supported.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>2*1024*1024)throw new PublicError('Choose a photo under 2 MB.',413);try{const info=await sharp(bytes,{limitInputPixels:20000000}).metadata();if(!['jpeg','png','webp'].includes(info.format)||(info.pages||1)>1||!info.width||!info.height)throw Error();const image=await sharp(bytes,{limitInputPixels:20000000}).rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).jpeg({quality:78}).toBuffer();if(image.length>512000)throw Error();return image;}catch{throw new PublicError('That photo could not be processed. Try a smaller JPG, PNG or WEBP (up to 20 megapixels).');}}
function authorizedCleanup(req){const secret=process.env.CRON_SECRET;const actual=req.headers.authorization||'';if(!secret||actual.length!==`Bearer ${secret}`.length)return false;return timingSafeEqual(Buffer.from(actual),Buffer.from(`Bearer ${secret}`));}
async function recoverVideos(){if(!process.env.SUPABASE_URL)return 0;let count=await videoJobs.cleanupAbandoned();for(const job of (await videoJobs.store.pending()).slice(0,2)){await videoJobs.advance(job.id);count++;}return count;}
let lastCleanup=0;
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/c/')||url.pathname.startsWith('/api/')||/^\/(manage|admin|edit)(\/|$)/.test(url.pathname))res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 try{
 if(await videoRoute(req,res,url,{json,body,sameOrigin,ipHash,cleanPhoto,fastLimit}))return;
 if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,{ready:storageReady()&&(!(process.env.VERCEL||process.env.APP_ENV==='production')||Boolean(process.env.APP_SECRET?.length>=32)),video:publicVideoConfig(videoJobs.config()),analytics:enabled(req.headers.host),campaigns:(process.env.ANALYTICS_CAMPAIGNS||'launch,instagram,tiktok,newsletter,friends').split(',')});
 if(url.pathname==='/api/cleanup'&&req.method==='GET'){if(!authorizedCleanup(req))throw new PublicError('Not authorized.',401);return json(res,200,{removed:await cleanup(),videoRecovery:await recoverVideos()});}
 if(url.pathname==='/api/events'&&req.method==='POST'){
  sameOrigin(req);if(!enabled(req.headers.host)){res.writeHead(204);return res.end();}
  fastLimit(req,'events',250);const data=await body(req,2000);if(!allowedBrowserEvent(data?.event))throw new PublicError('Invalid event.');
  const delivered=await capture(data.event,data.visitor,data.context,req.headers.host,data.eventId&&/^[a-f0-9-]{36}$/.test(data.eventId)?data.eventId:undefined);return json(res,delivered?202:503,{accepted:delivered});
 }
 if(url.pathname==='/api/cards'&&req.method==='POST'){
  sameOrigin(req);fastLimit(req,'create',localTesting()?200:20);
  if((process.env.VERCEL||process.env.APP_ENV==='production')&&(!cloud||!process.env.APP_SECRET||process.env.APP_SECRET.length<32))throw new PublicError('The card studio is being set up. Please come back soon.',503);
  const origin=baseUrl(req); // Validate URL configuration before saving anything.
  const data=await body(req,2900000);const card=validate(data);
  await reserveCreation(ipHash(req)); // Rate-limit image decoding/upload as part of creation.
  const image=await cleanPhoto(data.photo);
  if(Date.now()-lastCleanup>3600000){lastCleanup=Date.now();await cleanup().catch(()=>console.warn('Pending-upload cleanup needs attention.'));}
  const id=await saveCard(card,image);
  const context=cleanContext(data.analytics?.context);context.page_type='landing';
  await capture('card_created',data.analytics?.visitor,context,req.headers.host,randomUUID());
  if(context.from_recipient)await capture('recipient_became_creator',data.analytics?.visitor,context,req.headers.host,randomUUID());
  return json(res,201,{id,url:`${origin}/c/${id}`});
 }
 const match=url.pathname.match(new RegExp(`^/api/cards/(${idPattern})(/photo)?$`));
 if(match&&req.method==='GET'){
  fastLimit(req,'read',600);
  if(match[2]){const photo=await getPhoto(match[1]);res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=3600'});return res.end(photo);}
  try{return json(res,200,await getCard(match[1]));}catch(error){if(error.status!==404)throw error;return json(res,200,await videoJobs.card(match[1]));}
 }
 if(req.method!=='GET'&&req.method!=='HEAD')throw new PublicError('Method not allowed.',405);
 if(url.pathname==='/index.html'){res.writeHead(308,{Location:'/'});return res.end();}
 if(url.pathname==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end(`User-agent: *
Disallow: /c/
Disallow: /api/
Disallow: /manage/
Disallow: /admin/
Disallow: /edit/
Sitemap: ${baseUrl(req)}/sitemap.xml
`);}
 if(url.pathname==='/sitemap.xml'){res.writeHead(200,{'Content-Type':'application/xml'});return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl(req)}/</loc></url></urlset>`);}
 const assets={'/':'index.html','/style.css':'style.css','/app.js':'app.js','/video.js':'video.js','/scratch.js':'scratch.js','/scene.js':'scene.js','/penguin-studio.png':'penguin-studio.png','/pip-cutout.png':'pip-cutout.png','/analytics.js':'analytics.js','/generic-cover.svg':'generic-cover.svg','/social-preview.png':'social-preview.png','/favicon-32.png':'favicon-32.png','/icon-192.png':'icon-192.png','/apple-touch-icon.png':'apple-touch-icon.png','/favicon.ico':'favicon-32.png'};
 const asset=/^\/c\/[^/]+$/.test(url.pathname)?'index.html':assets[url.pathname];
 if(!asset)throw new PublicError('Not found.',404);
 let content=await readFile(path.join(root,asset));
 if(asset==='index.html'){
  content=content.toString().replace('<!--METADATA-->',metadata(baseUrl(req),url.pathname));
  if(url.pathname.startsWith('/c/'))content=content.replace('<body>','<body class="recipient">').replace('id="editor-panel"','id="editor-panel" hidden').replace('id="card"','id="card" hidden').replace('class="sticker"','class="sticker" hidden');
  // Generic metadata is identical for all cards; no content fetch occurs during HTML rendering.
 }
 res.writeHead(200,{'Content-Type':asset.endsWith('.png')?'image/png':asset.endsWith('.css')?'text/css':asset.endsWith('.js')?'text/javascript':asset.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:content);
 }catch(error){if(!res.headersSent)return json(res,error instanceof PublicError?error.status:500,{error:error instanceof PublicError?error.message:'The card studio is unavailable. Please try again.'});res.end();}
}
