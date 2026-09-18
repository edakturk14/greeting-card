import {readFile} from 'node:fs/promises';
import pg from 'pg';

// Run against the dedicated SendFiggle project. Never log connection strings.
let connectionString=process.env.POSTGRES_URL_NON_POOLING||process.env.POSTGRES_URL||process.env.DATABASE_URL;
if(!connectionString){console.error('Database connection missing. Pull the Supabase integration environment first.');process.exit(1);}
const url=new URL(connectionString);for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])url.searchParams.delete(key);connectionString=url.href;
const ssl={rejectUnauthorized:true,ca:await readFile(new URL('../db/supabase-ca.crt',import.meta.url),'utf8')};
const client=new pg.Client({connectionString,ssl,connectionTimeoutMillis:15000,statement_timeout:60000,application_name:'sendfiggle-schema-setup'});
try{
 await client.connect();
 await client.query('BEGIN');
 await client.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const {rows}=await client.query("select relname,relrowsecurity from pg_class where oid in ('public.cards'::regclass,'public.card_limits'::regclass,'public.video_jobs'::regclass)");
 if(rows.length!==3||rows.some(row=>!row.relrowsecurity))throw Error('Row-level security verification failed');
 const buckets=await client.query("select id,public from storage.buckets where id in ('card-photos','video-media')");
 if(buckets.rowCount!==2||buckets.rows.some(row=>row.public))throw Error('Private storage verification failed');
 const access=await client.query("select has_table_privilege('anon','public.cards','SELECT') as cards,has_table_privilege('anon','public.video_jobs','SELECT') as jobs");
 if(access.rows[0].cards||access.rows[0].jobs)throw Error('Anonymous table access must be disabled');
 await client.query('COMMIT');
 console.log('Database schema applied. Three protected tables and two private media buckets verified.');
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('Database setup failed. No connection secrets were logged. Error code:',error.code||'verification_or_connection_error');process.exitCode=1;}finally{await client.end().catch(()=>{});}
