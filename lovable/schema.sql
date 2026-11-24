-- Team Sufra's quote agent: the Supabase tables for the Lovable version.
-- Team Sufra, its users and every figure are fictional.
--
-- Run the sections up to the stage you are on, in order, in the Supabase SQL editor.
-- Each section only adds to the one before it, as WORKFLOW.md's "What is added" column says.
-- Run each section once. Do not re-run a stage 1 to 3 section after stage 4: it would put back
-- the "any signed-in user" policies that stage 4 replaces.
-- Lovable creates these tables itself from the prompts; use this file to check its work
-- or to repair a table that has drifted.
--
-- Edge functions use the service role key, which bypasses row-level security. The client
-- (no login) never reads a table directly: the edge functions read and write for it.
--
-- One table here is not in WORKFLOW.md: `settings` (stage 3) holds the daily limit and the
-- switch that turns the model off for the "tool failure" test.

-- =====================================================================================
-- STAGE 1: connect it. A conversation per client; Huda logs in to see the inbox.
-- (Lovable has no server memory, so the conversation is stored from stage 1.)
-- =====================================================================================

create table if not exists public.enquiries (
  id            uuid primary key default gen_random_uuid(),
  client_token  text not null,                       -- secret kept in the client's browser; proves the chat is theirs
  status        text not null default 'asked'
                check (status in ('asked','awaiting_approval','handed_over','failed','sent','rejected')),
  asked         boolean not null default false,      -- has the agent asked its one question?
  summary       text,
  draft         text,                                -- the message waiting for Huda's approval
  note          text,                                -- why it was handed over or failed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  enquiry_id  uuid not null references public.enquiries(id) on delete cascade,
  sender      text not null check (sender in ('client','agent','caterer')),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists messages_enquiry on public.messages (enquiry_id, created_at);

alter table public.enquiries enable row level security;
alter table public.messages  enable row level security;

-- Stage 1 to 3: the only login is Huda's, so any signed-in user is Huda.
drop policy if exists "caterer reads enquiries"   on public.enquiries;
drop policy if exists "caterer updates enquiries" on public.enquiries;
drop policy if exists "caterer reads messages"    on public.messages;
drop policy if exists "caterer adds messages"     on public.messages;
create policy "caterer reads enquiries"   on public.enquiries for select to authenticated using (true);
create policy "caterer updates enquiries" on public.enquiries for update to authenticated using (true) with check (true);
create policy "caterer reads messages"    on public.messages  for select to authenticated using (true);
create policy "caterer adds messages"     on public.messages  for insert to authenticated with check (sender in ('agent','caterer'));

-- Huda's login: create it in Supabase > Authentication > Users > Add user (email + password).
-- There is no sign-up page.

-- =====================================================================================
-- STAGE 2: real data. The price list lives here; quotes keep the prices they were drafted at.
-- =====================================================================================

create table if not exists public.price_list (
  item_id     text primary key,
  name        text not null,
  price       integer not null check (price >= 0),   -- AED, per unit
  unit        text not null check (unit in ('guest','child','cake','person','event')),
  includes    text not null default '',
  updated_at  timestamptz not null default now()
);

-- Huda's price list (coded/data/business.json)
insert into public.price_list (item_id, name, price, unit, includes)
select * from (values
  ('classic_buffet',   'Classic buffet',          85, 'guest',  'Two mains, rice, three salads, bread and one dessert'),
  ('premium_buffet',   'Premium buffet',         140, 'guest',  'Four mains with a live grill station, rice, five salads, bread and two desserts'),
  ('canape_platters',  'Canapé platters',         45, 'guest',  'Eight bites per guest, hot and cold, for receptions and standing events'),
  ('kids_menu',        'Kids'' menu',             35, 'child',  'Mini burgers, chicken bites, fruit cups and a juice box'),
  ('drinks',           'Soft drinks and juices',  15, 'guest',  'Water, soft drinks and two fresh juices, served for four hours'),
  ('celebration_cake', 'Celebration cake',       320, 'cake',   'Serves 30, one flavor, a name or message on top'),
  ('service_staff',    'Service staff',          220, 'person', 'One server for four hours: setting up, serving and clearing'),
  ('delivery_setup',   'Delivery and setup',     150, 'event',  'Delivery anywhere in Dubai, chafing dishes and table setup')
) as v(item_id, name, price, unit, includes)
where not exists (select 1 from public.price_list);

-- The quote as drafted: {"lines":[{"item_id","name","unit","qty","unit_price","amount"}],
--                        "subtotal", "rush_fee", "total", "currency":"AED", "guests", "event_date", "valid_days":7}
-- The rules (at least 15 per guest, at most 200 guests, 25% rush fee under 3 days, valid 7 days)
-- and Huda's booked days stay in handle-message's code.
alter table public.enquiries add column if not exists quote jsonb;

create table if not exists public.log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  enquiry_id  uuid references public.enquiries(id) on delete cascade,
  step        text not null,     -- receive | mask | read | decide | price | hold | approve | edit | reject | send | fail | limit | delete
  detail      text not null default ''   -- what happened, in a few words; no client message text
);
create index if not exists log_enquiry on public.log (enquiry_id, at);

alter table public.price_list enable row level security;
alter table public.log        enable row level security;
drop policy if exists "caterer reads prices"  on public.price_list;
drop policy if exists "caterer edits prices"  on public.price_list;
drop policy if exists "caterer reads log"     on public.log;
drop policy if exists "caterer writes log"    on public.log;
create policy "caterer reads prices" on public.price_list for select to authenticated using (true);
create policy "caterer edits prices" on public.price_list for update to authenticated using (true) with check (true);
create policy "caterer reads log"    on public.log for select to authenticated using (true);
create policy "caterer writes log"   on public.log for insert to authenticated with check (step in ('approve','edit','reject','send'));

-- =====================================================================================
-- STAGE 3: run it safely. Token usage and cost, 30-day deletion, daily limit, model switch.
-- =====================================================================================

alter table public.enquiries add column if not exists last_message_at timestamptz not null default now();
alter table public.enquiries add column if not exists tokens_in  integer not null default 0;
alter table public.enquiries add column if not exists tokens_out integer not null default 0;
alter table public.enquiries add column if not exists cost_usd   numeric(12,6) not null default 0;
alter table public.enquiries add column if not exists model_saw  text;   -- the masked text the model last received

-- One row for the whole team: one API key, one bill.
create table if not exists public.settings (
  id           integer primary key default 1 check (id = 1),
  daily_limit  integer not null default 200,   -- new enquiries per day (Dubai time); 200 is the coded version's default
  model_on     boolean not null default true   -- switch off to run the "tool failure" test
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;
drop policy if exists "caterer reads settings" on public.settings;
drop policy if exists "caterer edits settings" on public.settings;
create policy "caterer reads settings" on public.settings for select to authenticated using (true);
create policy "caterer edits settings" on public.settings for update to authenticated using (true) with check (true);

-- Each enquiry is deleted 30 days after its last message (its messages and log lines go with it).
create or replace function public.delete_expired_enquiries()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.enquiries where last_message_at < now() - interval '30 days' returning id
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.delete_expired_enquiries() from public, anon, authenticated;

-- Option A (used in the prompts): the handle-message edge function calls
--   select public.delete_expired_enquiries();  at the start of every request.
-- Option B: schedule it once a day with pg_cron (enable the pg_cron extension first):
--   select cron.schedule('delete-expired-enquiries', '0 0 * * *', $$select public.delete_expired_enquiries()$$);

-- =====================================================================================
-- STAGE 4: grow it. Several caterers, each with their own login, price list and enquiries.
-- One log the team can read.
-- =====================================================================================

create table if not exists public.caterers (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  slug     text not null unique,            -- the client chat link: /chat/<slug>
  user_id  uuid unique references auth.users(id) on delete set null,   -- the caterer's login
  city     text not null default 'Dubai'
);
insert into public.caterers (name, slug) values ('Huda', 'huda') on conflict (slug) do nothing;
-- Link Huda's login (create the user first in Authentication > Users):
--   update public.caterers set user_id = (select id from auth.users where email = '<huda''s email>') where slug = 'huda';
-- A second caterer: add a login, then
--   insert into public.caterers (name, slug, user_id) values ('<name>', '<slug>', (select id from auth.users where email = '<email>'));
--   insert into public.price_list (caterer_id, item_id, name, price, unit, includes)
--     select (select id from public.caterers where slug = '<slug>'), item_id, name, price, unit, includes
--     from public.price_list where caterer_id = (select id from public.caterers where slug = 'huda');

-- Every row belongs to one caterer. Existing rows are Huda's.
alter table public.price_list add column if not exists caterer_id uuid references public.caterers(id) on delete cascade;
alter table public.enquiries  add column if not exists caterer_id uuid references public.caterers(id) on delete cascade;
alter table public.log        add column if not exists caterer_id uuid references public.caterers(id) on delete cascade;
update public.price_list set caterer_id = (select id from public.caterers where slug = 'huda') where caterer_id is null;
update public.enquiries  set caterer_id = (select id from public.caterers where slug = 'huda') where caterer_id is null;
update public.log        set caterer_id = (select id from public.caterers where slug = 'huda') where caterer_id is null;
alter table public.price_list alter column caterer_id set not null;
alter table public.enquiries  alter column caterer_id set not null;

-- Each caterer has their own row per menu item
alter table public.price_list drop constraint if exists price_list_pkey;
alter table public.price_list add primary key (caterer_id, item_id);

-- The signed-in caterer's id
create or replace function public.my_caterer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.caterers where user_id = auth.uid() $$;

alter table public.caterers enable row level security;
drop policy if exists "caterers see the team" on public.caterers;
create policy "caterers see the team" on public.caterers for select to authenticated using (true);

-- Replace the stage 1-3 "any signed-in user" policies with "only your own rows"
drop policy if exists "caterer reads enquiries"   on public.enquiries;
drop policy if exists "caterer updates enquiries" on public.enquiries;
drop policy if exists "caterer reads messages"    on public.messages;
drop policy if exists "caterer adds messages"     on public.messages;
drop policy if exists "caterer reads prices"      on public.price_list;
drop policy if exists "caterer edits prices"      on public.price_list;
drop policy if exists "caterer reads log"         on public.log;
drop policy if exists "caterer writes log"        on public.log;
drop policy if exists "team reads log"             on public.log;

create policy "caterer reads enquiries" on public.enquiries for select to authenticated
  using (caterer_id = public.my_caterer_id());
create policy "caterer updates enquiries" on public.enquiries for update to authenticated
  using (caterer_id = public.my_caterer_id()) with check (caterer_id = public.my_caterer_id());

create policy "caterer reads messages" on public.messages for select to authenticated
  using (exists (select 1 from public.enquiries e where e.id = enquiry_id and e.caterer_id = public.my_caterer_id()));
create policy "caterer adds messages" on public.messages for insert to authenticated
  with check (sender in ('agent','caterer')
              and exists (select 1 from public.enquiries e where e.id = enquiry_id and e.caterer_id = public.my_caterer_id()));

create policy "caterer reads prices" on public.price_list for select to authenticated
  using (caterer_id = public.my_caterer_id());
create policy "caterer edits prices" on public.price_list for update to authenticated
  using (caterer_id = public.my_caterer_id()) with check (caterer_id = public.my_caterer_id());

-- One log the team can read: every caterer reads every line (lines hold steps, never client text)
create policy "team reads log" on public.log for select to authenticated using (true);
create policy "caterer writes log" on public.log for insert to authenticated
  with check (caterer_id = public.my_caterer_id() and step in ('approve','edit','reject','send'));
