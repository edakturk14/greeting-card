import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,mkdir,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import sharp from 'sharp';
import {cleanContext,capture,enabled} from '../lib/analytics.mjs';
test('saved cards and photos survive restart, remain immutable, and reject invalid requests',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'als-test-'));let child;
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3012',DATA_DIR:dir,APP_ENV:'development',PUBLIC_BASE_URL:'https://cards.example.test',CRON_SECRET:'test-cleanup-secret'},stdio:['ignore','pipe','pipe']});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server failed to start');})]);}
 async function stop(){const exited=once(child,'exit');child.kill();await exited;}
 const base='http://localhost:3012';const image=await sharp({create:{width:400,height:400,channels:3,background:'#f3b6c9'}}).png().toBuffer();
 const card={to:'Çağrı Şen',cover:'A little surprise for you…',message:'İyi ki doğdun!\n<script>not executable</script>',from:'Eda',color:'silver',photo:`data:image/png;base64,${image.toString('base64')}`};
 const post=(body,origin=base)=>fetch(base+'/api/cards',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 try{
 await start();assert.equal((await post(card,'https://other.test')).status,403);assert.equal((await post({...card,message:' '})).status,400);assert.equal((await post({...card,message:'a'.repeat(1201)})).status,400);assert.equal((await post({...card,color:'blue'})).status,400);
 const response=await post(card);assert.equal(response.status,201);const result=await response.json();assert.match(result.id,/^[A-Za-z0-9_-]{32}$/);assert.equal(result.url,`https://cards.example.test/c/${result.id}`);
 const rawHtml=await fetch(base+'/c/'+result.id);assert.match(rawHtml.headers.get('X-Robots-Tag'),/noindex/);const html=await rawHtml.text();assert.ok(!html.includes(card.to));assert.ok(!html.includes(card.message));assert.match(html,/social-preview.png/);assert.match(html,/You’ve got a surprise — SendFiggle/);assert.match(html,/summary_large_image/);assert.ok(!html.includes(card.from));
 const home=await(await fetch(base+'/')).text();assert.match(home,/<title>SendFiggle — Scratch-to-Reveal Cards<\/title>/);assert.match(home,/https:\/\/cards.example.test\/social-preview.png/);assert.match(home,/content="index,follow"/);assert.match(home,/og:site_name" content="SendFiggle"/);
 const sitemap=await(await fetch(base+'/sitemap.xml')).text();assert.match(sitemap,/<loc>https:\/\/cards.example.test\/<\/loc>/);assert.ok(!sitemap.includes('/c/'));assert.ok(!sitemap.includes(result.id));
 for(const [asset,w,h]of [['social-preview.png',1200,630],['favicon-32.png',32,32],['apple-touch-icon.png',180,180]]){const assetResponse=await fetch(base+'/'+asset);assert.equal(assetResponse.status,200);assert.equal(assetResponse.headers.get('content-type'),'image/png');const size=await sharp(Buffer.from(await assetResponse.arrayBuffer())).metadata();assert.equal(size.width,w);assert.equal(size.height,h);}
 assert.match((await fetch(base+'/manage/anything')).headers.get('x-robots-tag'),/noindex/);
 await stop();await start();const saved=await(await fetch(base+'/api/cards/'+result.id)).json();for(const key of ['to','cover','message','from','color'])assert.equal(saved[key],card[key]);
 const photo=await fetch(base+saved.photo);assert.equal(photo.headers.get('Content-Type'),'image/jpeg');const metadata=await sharp(Buffer.from(await photo.arrayBuffer())).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);
 assert.equal((await fetch(base+'/data/'+result.id+'.json')).status,404);assert.equal((await fetch(base+'/archive/index.html')).status,404);assert.equal((await fetch(base+'/api/cards')).status,404);assert.equal((await fetch(base+'/api/cards/'+'a'.repeat(32))).status,404);assert.equal((await fetch(base+'/api/cards/'+result.id,{method:'PATCH'})).status,405);
 const edit=await(await post({...card,message:'Updated note',to:'',from:'',photo:null})).json();assert.notEqual(edit.id,result.id);const nameless=await(await fetch(base+'/api/cards/'+edit.id)).json();assert.equal(nameless.to,'');assert.equal(nameless.from,'');assert.equal((await(await fetch(base+'/api/cards/'+result.id)).json()).message,card.message);
 assert.equal((await post({...card,photo:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
 assert.equal((await post({...card,photo:'data:image/png;base64,YmFk'})).status,400);
 const tooLarge=await post({...card,photo:'data:image/jpeg;base64,'+Buffer.alloc(2100000).toString('base64')});assert.equal(tooLarge.status,413);
 assert.equal((await post(card)).status,429);
 const orphan='o'.repeat(32);await mkdir(path.join(dir,'images'),{recursive:true});await writeFile(path.join(dir,'images',orphan+'.jpg'),image);await writeFile(path.join(dir,orphan+'.json'),JSON.stringify({status:'pending',photo:orphan+'.jpg',created_at:'2020-01-01T00:00:00Z'}));
 assert.equal((await fetch(base+'/api/cleanup')).status,401);const cleaned=await(await fetch(base+'/api/cleanup',{headers:{Authorization:'Bearer test-cleanup-secret'}})).json();assert.equal(cleaned.removed,1);assert.ok(!(await readdir(path.join(dir,'images'))).includes(orphan+'.jpg'));
 const conf=await(await fetch(base+'/api/config')).json();assert.equal(conf.analytics,false);
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
test('analytics forwards only a strict anonymous allowlist and disables local traffic',async()=>{
 const oldFetch=global.fetch;const oldEnv={...process.env};let payload;
 process.env.APP_ENV='production';process.env.POSTHOG_KEY='test-project-token';process.env.POSTHOG_HOST='https://us.i.posthog.com';
 global.fetch=async(url,options)=>{assert.equal(url,'https://us.i.posthog.com/i/v0/e/');payload=JSON.parse(options.body);return new Response('{}',{status:200});};
 try{
 assert.equal(enabled('localhost:3001'),false);assert.equal(enabled('192.168.1.2:3001'),false);
 const raw={page_type:'recipient',name:'SECRET NAME',message:'SECRET MESSAGE',photo:'SECRET PHOTO',url:'https://host/c/SECRET_TOKEN',referrer:'https://host/c/SECRET_TOKEN',utm_campaign:'SECRET NAME',method:'scratch',from_recipient:true};
 assert.equal(cleanContext(raw).utm_campaign,'other');
 const result=await capture('reveal_completed','00000000-0000-4000-8000-000000000000',raw,'cards.vercel.app');assert.equal(result,true);
 const serialized=JSON.stringify(payload);for(const secret of ['SECRET NAME','SECRET MESSAGE','SECRET PHOTO','SECRET_TOKEN'])assert.ok(!serialized.includes(secret));assert.equal(payload.properties.$pathname,'/c/:id');assert.equal(payload.properties.$ip,null);assert.equal(payload.properties.method,'scratch');assert.equal(payload.properties.$process_person_profile,false);
 process.env.APP_ENV='development';assert.equal(enabled('cards.vercel.app'),false);
 }finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});

test('production URL configuration rejects local origins and never trusts incoming host',async()=>{
 const {baseUrl}=await import('../lib/metadata.mjs');const keys=['APP_ENV','PUBLIC_BASE_URL','VERCEL','VERCEL_URL','VERCEL_PROJECT_PRODUCTION_URL'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{process.env.APP_ENV='production';for(const k of keys.slice(1))delete process.env[k];const req={headers:{host:'evil.invalid'}};assert.throws(()=>baseUrl(req));
 for(const url of ['http://localhost:3001','https://192.168.1.2','https://127.0.0.1','https://[::1]','https://home.local','https://10.0.0.2','https://example.com/path']){process.env.PUBLIC_BASE_URL=url;assert.throws(()=>baseUrl(req));}
 delete process.env.PUBLIC_BASE_URL;process.env.VERCEL_URL='sendfiggle-preview.vercel.app';assert.equal(baseUrl(req),'https://sendfiggle-preview.vercel.app');process.env.PUBLIC_BASE_URL='https://sendfiggle.com/';assert.equal(baseUrl(req),'https://sendfiggle.com');
 }finally{for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

test('local test mode cannot bypass hosted or production limits',async()=>{
 const {localTesting}=await import('../lib/local-testing.mjs');const keys=['LOCAL_TEST_MODE','APP_ENV','NODE_ENV','VERCEL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{for(const k of keys)delete process.env[k];process.env.APP_ENV='development';assert.equal(localTesting(),false);process.env.LOCAL_TEST_MODE='1';assert.equal(localTesting(),true);
 for(const [k,v]of [['APP_ENV','production'],['NODE_ENV','production'],['VERCEL','1'],['SUPABASE_URL','https://test.supabase.co'],['SUPABASE_SERVICE_ROLE_KEY','test']]){const old=process.env[k];process.env[k]=v;assert.equal(localTesting(),false,k);if(old===undefined)delete process.env[k];else process.env[k]=old;}
 }finally{for(const [k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
