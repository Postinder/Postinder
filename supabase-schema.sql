-- ═══════════════════════════════════════════════════════════════
-- POSTINDER — Schema SQL para Supabase
-- Execute este SQL no editor SQL do seu projeto Supabase:
-- Dashboard → SQL Editor → New query → Cole e execute
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ──
create extension if not exists "pgcrypto";

-- ── Enums ──
create type user_role    as enum ('admin', 'gestor', 'equipe');
create type file_status  as enum ('PENDING', 'APPROVED', 'REJECTED', 'UPDATED');
create type file_type    as enum ('IMAGE', 'VIDEO', 'PDF', 'DOCUMENT', 'OTHER');
create type funnel_tag   as enum ('topo', 'meio', 'fundo');

-- ══════════════════════
-- USERS (internal team)
-- ══════════════════════
create table users (
  id            uuid primary key default auth.uid(),
  name          text not null,
  email         text not null unique,
  role          user_role not null default 'gestor',
  permissions   text[] default '{}',
  avatar_url    text,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);

-- ══════════════════════
-- CLIENTS
-- ══════════════════════
create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  whatsapp      text,
  document      text,
  document_type text check (document_type in ('cpf','cnpj')),
  segment       text,
  color         text default '#A7014B',
  deadline_days int  default 7,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);

-- ══════════════════════
-- CLIENT TOKENS (approval links)
-- ══════════════════════
create table client_tokens (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  token       text not null unique,
  slug        text not null unique,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  last_used_at timestamptz,
  created_at  timestamptz default now()
);

-- ══════════════════════
-- POSTS
-- ══════════════════════
create table posts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  created_by_id   uuid references users(id) on delete set null,
  title           text not null,
  channels        text[] default '{}',
  formats         jsonb  default '{}',
  caption         text,
  scheduled_date  date,
  funnel_tag      funnel_tag,
  email_link      text,
  justificativa   text,
  resubmit_count  int  default 0,
  link_sent_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

-- ══════════════════════
-- POST FILES
-- ══════════════════════
create table post_files (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  name          text not null,
  original_name text,
  file_type     file_type default 'IMAGE',
  mime_type     text,
  size_bytes    int,
  storage_key   text,
  storage_url   text,
  thumbnail_url text,
  status        file_status default 'PENDING',
  version       int default 1,
  updated_badge boolean default false,
  sort_order    int default 0,
  expires_at    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ══════════════════════
-- FILE VERSIONS (history)
-- ══════════════════════
create table file_versions (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid not null references post_files(id) on delete cascade,
  version      int not null,
  storage_key  text,
  storage_url  text,
  size_bytes   int,
  replaced_at  timestamptz default now()
);

-- ══════════════════════
-- FILE FEEDBACKS
-- ══════════════════════
create table file_feedbacks (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid not null references post_files(id) on delete cascade,
  tags         text[] default '{}',
  comment      text,
  file_version int default 1,
  created_at   timestamptz default now()
);

-- ══════════════════════
-- CLIENT FEEDBACKS (monthly)
-- ══════════════════════
create table client_feedbacks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  rating     int check (rating between 1 and 5),
  text       text,
  month      text not null, -- format: YYYY-MM
  created_at timestamptz default now()
);

-- ══════════════════════
-- NOTIFICATIONS
-- ══════════════════════
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  client_id   uuid references clients(id) on delete cascade,
  post_id     uuid references posts(id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  is_read     boolean default false,
  metadata    jsonb,
  created_at  timestamptz default now()
);

-- ══════════════════════
-- EMAIL CONFIG
-- ══════════════════════
create table email_config (
  id            uuid primary key default gen_random_uuid(),
  sender_name   text default '20cinco comunicação',
  reply_to      text,
  subject       text default 'Você tem conteúdos aguardando aprovação!',
  body_template text,
  updated_at    timestamptz default now()
);

insert into email_config (reply_to, body_template) values
  ('contato@20cin.co', 'Olá! Seus conteúdos da semana estão prontos para aprovação. Clique no botão abaixo, revise cada arquivo e aprove ou solicite ajustes.');

-- ══════════════════════
-- INSIGHT SNAPSHOTS (persist metrics after file cleanup)
-- ══════════════════════
create table insight_snapshots (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients(id) on delete cascade,
  date              date not null,
  total_posts       int default 0,
  approved_files    int default 0,
  rejected_files    int default 0,
  pending_files     int default 0,
  avg_approval_days float,
  top_reject_tags   jsonb,
  channel_breakdown jsonb,
  created_at        timestamptz default now(),
  unique(date, client_id)
);

-- ══════════════════════
-- AUDIT LOGS
-- ══════════════════════
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  post_id     uuid references posts(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  created_at  timestamptz default now()
);

-- ══════════════════════
-- INDEXES
-- ══════════════════════
create index on posts(client_id);
create index on posts(created_at desc);
create index on posts(deleted_at) where deleted_at is null;
create index on post_files(post_id);
create index on post_files(status);
create index on post_files(expires_at) where expires_at is not null;
create index on file_feedbacks(file_id);
create index on notifications(user_id, is_read);
create index on client_tokens(slug);
create index on insight_snapshots(client_id, date);

-- ══════════════════════
-- STORAGE BUCKET
-- Execute separadamente via Supabase Dashboard → Storage
-- ══════════════════════
-- insert into storage.buckets (id, name, public) values ('post-files', 'post-files', true);

-- ══════════════════════
-- AUTO CLEANUP (files older than 7 days)
-- Requires pg_cron extension — enable in Supabase Dashboard → Database → Extensions
-- ══════════════════════
-- select cron.schedule(
--   'cleanup-expired-files',
--   '0 3 * * *',
--   $$
--     delete from storage.objects
--     where bucket_id = 'post-files'
--       and created_at < now() - interval '7 days';
--
--     update post_files set storage_url = null
--     where expires_at < now() and storage_url is not null;
--   $$
-- );

-- ══════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════
alter table users           enable row level security;
alter table clients         enable row level security;
alter table client_tokens   enable row level security;
alter table posts           enable row level security;
alter table post_files      enable row level security;
alter table file_feedbacks  enable row level security;
alter table client_feedbacks enable row level security;
alter table notifications   enable row level security;

-- Authenticated users (admin/gestor/equipe) can read everything
create policy "Auth users read all" on posts       for select using (auth.role() = 'authenticated');
create policy "Auth users read all" on post_files  for select using (auth.role() = 'authenticated');
create policy "Auth users read all" on clients     for select using (auth.role() = 'authenticated');

-- Authenticated users can insert/update/delete
create policy "Auth users write posts"      on posts      for all using (auth.role() = 'authenticated');
create policy "Auth users write post_files" on post_files for all using (auth.role() = 'authenticated');
create policy "Auth users write clients"    on clients    for all using (auth.role() = 'authenticated');
create policy "Auth users write feedbacks"  on file_feedbacks for all using (true);
create policy "Auth users write cli_fb"     on client_feedbacks for all using (true);

-- Storage policy
-- insert into storage.policies (name, bucket_id, operation, definition)
-- values ('Public read', 'post-files', 'SELECT', 'true'),
--        ('Auth upload',  'post-files', 'INSERT', 'auth.role() = ''authenticated''');
