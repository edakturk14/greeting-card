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
