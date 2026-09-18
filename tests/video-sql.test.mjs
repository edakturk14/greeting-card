import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('actual Postgres schema applies twice and atomically reserves/CAS-updates private jobs',async()=>{
 const db=new PGlite();try{await db.exec('create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');const schema=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
 const job={id:'a'.repeat(32),share_id:'b'.repeat(32),idempotency:'one',resume_hash:'secret-hash',fingerprint:'fingerprint',day:new Date().toISOString().slice(0,10),visitor_hash:'visitor',ip_hash:'ip',charge_cents:65,state:'uploading',rev:0};const caps={visitor:2,ip:2,daily:2,inflight:2,dailyCents:100,totalCents:100};
 const reserve=async j=>(await db.query('select public.reserve_video_job($1::jsonb,$2::jsonb) as result',[JSON.stringify(j),JSON.stringify(caps)])).rows[0].result;
 const results=await Promise.all([reserve(job),reserve({...job,id:'c'.repeat(32),share_id:'d'.repeat(32),idempotency:'two'})]);assert.equal(results.filter(r=>r.error==='limit').length,1);assert.equal((await reserve(job)).id,job.id);assert.equal((await reserve({...job,fingerprint:'different'})).error,'conflict');
 const update=async rev=>(await db.query('select public.update_video_job($1,$2,$3::jsonb) as result',[job.id,rev,JSON.stringify({...job,rev:rev+1,state:'voice_pending'})])).rows[0].result;
 assert.equal((await update(0)).state,'voice_pending');assert.equal(await update(0),null);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.video_jobs'));await assert.rejects(reserve({...job,idempotency:'evil'}));await db.exec('reset role');
 const buckets=(await db.query("select id,public,allowed_mime_types from storage.buckets order by id")).rows;assert.deepEqual(buckets[0].allowed_mime_types,['image/jpeg']);assert.equal(buckets[1].public,false);assert.ok(buckets[1].allowed_mime_types.includes('video/mp4'));
 }finally{await db.close();}
});
