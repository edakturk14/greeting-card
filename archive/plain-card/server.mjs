import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,'data');
const port=Number(process.env.PORT||3001);
await mkdir(dataDir,{recursive:true,mode:0o700});
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function shareBase(req){
 if(process.env.PUBLIC_BASE_URL)return process.env.PUBLIC_BASE_URL.replace(/\/$/,'');
 const host=req.headers.host||`localhost:${port}`;
 if(/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){
  const ip=Object.values(os.networkInterfaces()).flat().find(n=>n&&n.family==='IPv4'&&!n.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address));
  if(ip)return `http://${ip.address}:${port}`;
 }
 return `http://${host}`;
}
const limits={to:60,greeting:100,message:1500,from:60};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&url.pathname==='/api/cards'){
  const origin=req.headers.origin;
  if(!origin||new URL(origin).host!==req.headers.host)return json(res,403,{error:'Please create your card from this website.'});
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>12000){json(res,413,{error:'This note is too long. Please shorten it.'});return;}chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks));}catch{return json(res,400,{error:'We couldn’t read this card. Please try again.'});}
  const card={};
  for(const [key,max]of Object.entries(limits)){
   if(typeof body?.[key]!=='string'||!body[key].trim()||body[key].trim().length>max)return json(res,400,{error:`Please fill in ${key==='to'?'the recipient':key==='from'?'your name':key} (${max} characters maximum).`});
   card[key]=body[key].trim();
  }
  const id=randomBytes(18).toString('base64url');
  const stored={...card,createdAt:new Date().toISOString()};
  const temporary=path.join(dataDir,`${id}.tmp`);
  await writeFile(temporary,JSON.stringify(stored),{flag:'wx',mode:0o600});
  await rename(temporary,path.join(dataDir,`${id}.json`));
  return json(res,201,{id,url:`${shareBase(req)}/c/${id}`});
 }
 const match=url.pathname.match(/^\/api\/cards\/([A-Za-z0-9_-]{24})$/);
 if(req.method==='GET'&&match){
  try{return json(res,200,JSON.parse(await readFile(path.join(dataDir,`${match[1]}.json`),'utf8')));}
  catch(e){if(e.code==='ENOENT')return json(res,404,{error:'This card could not be found.'});throw e;}
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
 const assets={'/':'index.html','/style.css':'style.css','/app.js':'app.js'};
 const asset=/^\/c\/[^/]+$/.test(url.pathname)?'index.html':assets[url.pathname];
 if(!asset)return json(res,404,{error:'Not found.'});
 const content=await readFile(path.join(root,asset));
 res.writeHead(200,{'Content-Type':asset.endsWith('.css')?'text/css':asset.endsWith('.js')?'text/javascript':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content);
 }catch{if(!res.headersSent)json(res,500,{error:'Your card couldn’t be saved. Please try again.'});else res.end();}
});
server.listen(port,'0.0.0.0',()=>console.log(`Little note is running at http://localhost:${port}`));
