-- Run once in Supabase SQL Editor, using a dedicated Free project.
create table if not exists public.cards (
 id text primary key check (id ~ '^[A-Za-z0-9_-]{32}$'),
 to_name text not null check (char_length(to_name) between 0 and 60),
 cover text not null check (char_length(cover) between 1 and 100),
 message text not null check (char_length(message) between 1 and 1200),
 from_name text not null check (char_length(from_name) between 0 and 60),
 color text not null check (color in ('silver','pink','gold')),
 photo text,
 created_at timestamptz not null default now(),
 status text not null default 'pending' check (status in ('pending','ready','deleting'))
);
alter table public.cards enable row level security;
revoke all on public.cards from anon, authenticated;
grant all on public.cards to service_role;
create index if not exists cards_pending_idx on public.cards(created_at) where status <> 'ready';
create table if not exists public.card_limits (key text primary key, count integer not null default 0, expires_at timestamptz);
alter table public.card_limits enable row level security;
revoke all on public.card_limits from anon, authenticated;
grant all on public.card_limits to service_role;
create or replace function public.reserve_card(ip_hash text) returns boolean language plpgsql security definer set search_path=public as $$
declare keys text[]; caps integer[]:=array[5,20,50,1000]; i integer;
begin
 if ip_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 -- Serializes all tiny-pilot reservations, including across serverless instances.
 perform pg_advisory_xact_lock(38190422);
 delete from card_limits where expires_at<now();
 keys:=array['h:'||ip_hash||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD-HH24'),'d:'||ip_hash||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),'global:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),'lifetime'];
 for i in 1..4 loop
  if coalesce((select count from card_limits where key=keys[i]),0)>=caps[i] then return false; end if;
 end loop;
 for i in 1..4 loop
  insert into card_limits(key,count,expires_at) values(keys[i],1,case when i=4 then null else now()+interval '2 days' end)
  on conflict(key) do update set count=card_limits.count+1;
 end loop;
 return true;
end $$;
revoke all on function public.reserve_card(text) from public,anon,authenticated;
grant execute on function public.reserve_card(text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('card-photos','card-photos',false,512000,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=512000,allowed_mime_types=array['image/jpeg'];
-- No storage policies: browsers cannot upload, read, list or modify this bucket.
-- Photos are accessed through the server after looking up a ready card by its random ID.

-- Upgrade an existing scratch-card schema to optional names.
alter table public.cards drop constraint if exists cards_to_name_check;
alter table public.cards add constraint cards_to_name_check check (char_length(to_name) between 0 and 60);
alter table public.cards drop constraint if exists cards_from_name_check;
alter table public.cards add constraint cards_from_name_check check (char_length(from_name) between 0 and 60);

-- Optional video beta. Separate private media; existing scratch rows remain untouched.
alter table public.cards add column if not exists card_type text not null default 'scratch';
create table if not exists public.video_jobs (
 id text primary key check(id ~ '^[A-Za-z0-9_-]{32}$'),
 share_id text unique not null check(share_id ~ '^[A-Za-z0-9_-]{32}$'),
 idempotency text unique not null,
 state text not null,
 rev integer not null default 0,
 day text not null,
 visitor_hash text not null,
 ip_hash text not null,
 charge_cents integer not null check(charge_cents>=0),
 doc jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.video_jobs enable row level security;
revoke all on public.video_jobs from anon,authenticated;
grant all on public.video_jobs to service_role;
create index if not exists video_jobs_day_idx on public.video_jobs(day);
create or replace function public.reserve_video_job(candidate jsonb,caps jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare prior jsonb; amount integer:=(candidate->>'charge_cents')::integer; today text:=to_char(now() at time zone 'UTC','YYYY-MM-DD');
begin
 perform pg_advisory_xact_lock(38190423);
 select doc into prior from video_jobs where idempotency=candidate->>'idempotency';
 if prior is not null then
  if prior->>'fingerprint'<>candidate->>'fingerprint' or prior->>'resume_hash'<>candidate->>'resume_hash' then return '{"error":"conflict"}'::jsonb; end if;
  return prior;
 end if;
 if amount<65 or candidate->>'day'<>today or
  (select count(*) from video_jobs where day=today and visitor_hash=candidate->>'visitor_hash')>=coalesce((caps->>'visitor')::integer,0) or
  (select count(*) from video_jobs where day=today and ip_hash=candidate->>'ip_hash')>=coalesce((caps->>'ip')::integer,0) or
  (select count(*) from video_jobs where day=today)>=coalesce((caps->>'daily')::integer,0) or
  (select count(*) from video_jobs where state not in ('ready','failed','review'))>=coalesce((caps->>'inflight')::integer,0) or
  (select coalesce(sum(charge_cents),0) from video_jobs where day=today)+amount>coalesce((caps->>'dailyCents')::integer,0) or
  (select coalesce(sum(charge_cents),0) from video_jobs)+amount>coalesce((caps->>'totalCents')::integer,0)
 then return '{"error":"limit"}'::jsonb;end if;
 insert into video_jobs(id,share_id,idempotency,state,day,visitor_hash,ip_hash,charge_cents,doc)
 values(candidate->>'id',candidate->>'share_id',candidate->>'idempotency',candidate->>'state',today,candidate->>'visitor_hash',candidate->>'ip_hash',amount,candidate);
 return candidate;
end $$;
create or replace function public.update_video_job(job_id text,expected_rev integer,next_doc jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare changed jsonb;
begin
 perform pg_advisory_xact_lock(38190423);
 update video_jobs set doc=next_doc,rev=expected_rev+1,state=next_doc->>'state',charge_cents=(next_doc->>'charge_cents')::integer,updated_at=now()
 where id=job_id and rev=expected_rev and next_doc->>'id'=id and next_doc->>'share_id'=share_id and next_doc->>'idempotency'=idempotency and (next_doc->>'rev')::integer=expected_rev+1 returning doc into changed;
 return changed;
end $$;
revoke all on function public.reserve_video_job(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.update_video_job(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_video_job(jsonb,jsonb) to service_role;
grant execute on function public.update_video_job(text,integer,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('video-media','video-media',false,31457280,array['image/jpeg','audio/mpeg','video/mp4'])
 on conflict(id) do update set public=false,file_size_limit=31457280,allowed_mime_types=array['image/jpeg','audio/mpeg','video/mp4'];
-- No browser policies; only server service-role code reads/writes or issues short-lived URLs.
