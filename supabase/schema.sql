-- =============================================
-- POSTINDER — Supabase SQL Schema
-- Execute no SQL Editor do seu projeto Supabase
-- =============================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- ── USERS (perfis internos da agência) ─────────────────────
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  email         text not null unique,
  role          text not null default 'gestor' check (role in ('admin','gestor','equipe')),
  permissions   text[] default '{}',
  avatar_url    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── CLIENTS ────────────────────────────────────────────────
create table clients (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  email          text not null unique,
  password_plain text not null,  -- substitua por hash em produção
  whatsapp       text,
  document       text,
  document_type  text check (document_type in ('cpf','cnpj')),
  segment        text,
  color          text not null default '#A7014B',
  deadline_days  int  not null default 7,
  token          text not null unique,
  slug           text not null unique,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── POSTS ──────────────────────────────────────────────────
create table posts (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  channels        text[] not null default '{}',
  formats         jsonb not null default '{}',
  caption         text,
  funnel_tag      text check (funnel_tag in ('topo','meio','fundo')),
  scheduled_date  date,
  deadline_days   int  not null default 7,
  justificativa   text,
  resubmit_count  int  not null default 0,
  link_sent_at    timestamptz,
  client_id       uuid not null references clients(id) on delete cascade,
  created_by_id   uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index posts_client_id_idx on posts(client_id);
create index posts_created_at_idx on posts(created_at desc);

-- ── POST FILES ─────────────────────────────────────────────
create table post_files (
  id            uuid primary key default uuid_generate_v4(),
  post_id       uuid not null references posts(id) on delete cascade,
  name          text not null,
  file_type     text not null check (file_type in ('image','video','pdf','document','email')),
  mime_type     text not null default '',
  size_bytes    bigint,
  storage_key   text,
  storage_url   text,
  email_link    text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected','updated')),
  version       int  not null default 1,
  updated_badge boolean not null default false,
  sort_order    int  not null default 0,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index post_files_post_id_idx on post_files(post_id);
create index post_files_expires_at_idx on post_files(expires_at);

-- ── FILE FEEDBACKS ─────────────────────────────────────────
create table file_feedbacks (
  id           uuid primary key default uuid_generate_v4(),
  file_id      uuid not null references post_files(id) on delete cascade,
  tags         text[] not null default '{}',
  comment      text,
  file_version int  not null default 1,
  created_at   timestamptz not null default now()
);

-- ── FILE VERSIONS ──────────────────────────────────────────
create table file_versions (
  id          uuid primary key default uuid_generate_v4(),
  file_id     uuid not null references post_files(id) on delete cascade,
  version     int  not null,
  storage_key text,
  size_bytes  bigint,
  replaced_at timestamptz not null default now()
);

-- ── CLIENT FEEDBACKS ───────────────────────────────────────
create table client_feedbacks (
  id         uuid primary key default uuid_generate_v4(),
  client_id  uuid not null references clients(id) on delete cascade,
  month      text not null,  -- formato: '2025-04'
  rating     int  not null check (rating between 1 and 5),
  text       text not null,
  created_at timestamptz not null default now()
);

-- ── EMAIL CONFIG ───────────────────────────────────────────
create table email_config (
  id            uuid primary key default uuid_generate_v4(),
  sender_name   text not null default '20cinco comunicação',
  reply_to      text not null default 'contato@20cin.co',
  subject       text not null default 'Você tem conteúdos aguardando aprovação!',
  body_template text not null default 'Olá! Seus conteúdos estão prontos para aprovação.',
  updated_at    timestamptz not null default now()
);

-- ── NOTIFICATIONS ──────────────────────────────────────────
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references users(id) on delete set null,
  title       text not null,
  description text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── AUDIT LOG ──────────────────────────────────────────────
create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references users(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table users          enable row level security;
alter table clients        enable row level security;
alter table posts          enable row level security;
alter table post_files     enable row level security;
alter table file_feedbacks enable row level security;
alter table client_feedbacks enable row level security;
alter table email_config   enable row level security;
alter table notifications  enable row level security;

-- Allow authenticated users to read/write (refine per role in production)
create policy "Authenticated users have full access" on users          for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on clients        for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on posts          for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on post_files     for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on file_feedbacks for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on client_feedbacks for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on email_config   for all using (auth.role() = 'authenticated');
create policy "Authenticated users have full access" on notifications  for all using (auth.role() = 'authenticated');

-- Clients can access their own data (anon via client token validation)
create policy "Public read for active clients" on clients for select using (is_active = true);
create policy "Public read for posts" on posts for select using (deleted_at is null);
create policy "Public read for post_files" on post_files for select using (true);
create policy "Public write file status" on post_files for update using (true);
create policy "Public insert feedback" on file_feedbacks for insert with check (true);
create policy "Public insert client feedback" on client_feedbacks for insert with check (true);

-- ── STORAGE BUCKET ─────────────────────────────────────────
-- Execute no painel Storage do Supabase:
-- 1. Criar bucket: "post-files"
-- 2. Tornar público: sim
-- 3. Lifecycle rule: deletar após 7 dias

-- ── FIRST ADMIN USER ───────────────────────────────────────
-- Após criar o primeiro usuário pelo Supabase Auth,
-- insira o perfil manualmente:
-- INSERT INTO users (id, name, email, role)
-- VALUES ('<uuid-do-auth>', 'Caroline Paiva', 'admin@20cin.co', 'admin');
