-- ═══════════════════════════════════════════════════════════════
-- POSTINDER — Schema de Migração Segura
-- Execute este script no SQL Editor do Supabase
-- Usa IF NOT EXISTS em tudo — seguro para rodar múltiplas vezes
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums (cria só se não existir) ──
DO $$ BEGIN
  CREATE TYPE user_role  AS ENUM ('admin', 'gestor', 'equipe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE file_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UPDATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('IMAGE', 'VIDEO', 'PDF', 'DOCUMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE funnel_tag AS ENUM ('topo', 'meio', 'fundo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── USERS ──
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT auth.uid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'gestor',
  permissions   text[] DEFAULT '{}',
  avatar_url    text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  deleted_at    timestamptz
);

-- ── CLIENTS ──
CREATE TABLE IF NOT EXISTS clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  whatsapp      text,
  document      text,
  document_type text CHECK (document_type IN ('cpf','cnpj')),
  segment       text,
  color         text DEFAULT '#A7014B',
  deadline_days int  DEFAULT 7,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  deleted_at    timestamptz
);

-- ── CLIENT TOKENS ──
CREATE TABLE IF NOT EXISTS client_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  slug         text NOT NULL UNIQUE,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- ── POSTS ──
CREATE TABLE IF NOT EXISTS posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  title          text NOT NULL,
  channels       text[]  DEFAULT '{}',
  formats        jsonb   DEFAULT '{}',
  caption        text,
  scheduled_date date,
  funnel_tag     funnel_tag,
  email_link     text,
  justificativa  text,
  resubmit_count int DEFAULT 0,
  link_sent_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);

-- ── POST FILES ──
CREATE TABLE IF NOT EXISTS post_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  original_name text,
  file_type     file_type DEFAULT 'IMAGE',
  mime_type     text,
  size_bytes    int,
  storage_key   text,
  storage_url   text,
  thumbnail_url text,
  status        file_status DEFAULT 'PENDING',
  version       int DEFAULT 1,
  updated_badge boolean DEFAULT false,
  sort_order    int DEFAULT 0,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── FILE VERSIONS ──
CREATE TABLE IF NOT EXISTS file_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL REFERENCES post_files(id) ON DELETE CASCADE,
  version     int NOT NULL,
  storage_key text,
  storage_url text,
  size_bytes  int,
  replaced_at timestamptz DEFAULT now()
);

-- ── FILE FEEDBACKS ──
CREATE TABLE IF NOT EXISTS file_feedbacks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id      uuid NOT NULL REFERENCES post_files(id) ON DELETE CASCADE,
  tags         text[] DEFAULT '{}',
  comment      text,
  file_version int DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);

-- ── CLIENT FEEDBACKS (monthly) ──
CREATE TABLE IF NOT EXISTS client_feedbacks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rating    int CHECK (rating BETWEEN 1 AND 5),
  text      text,
  month     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── NOTIFICATIONS ──
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  post_id     uuid REFERENCES posts(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  description text,
  is_read     boolean DEFAULT false,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ── EMAIL CONFIG ──
CREATE TABLE IF NOT EXISTS email_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name   text DEFAULT '20cinco comunicação',
  reply_to      text,
  subject       text DEFAULT 'Você tem conteúdos aguardando aprovação!',
  body_template text,
  updated_at    timestamptz DEFAULT now()
);

-- Insere config padrão se não existir
INSERT INTO email_config (reply_to, body_template)
SELECT 'contato@20cin.co', 'Olá! Seus conteúdos estão prontos para aprovação.'
WHERE NOT EXISTS (SELECT 1 FROM email_config);

-- ── INSIGHT SNAPSHOTS ──
CREATE TABLE IF NOT EXISTS insight_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clients(id) ON DELETE CASCADE,
  date              date NOT NULL,
  total_posts       int DEFAULT 0,
  approved_files    int DEFAULT 0,
  rejected_files    int DEFAULT 0,
  pending_files     int DEFAULT 0,
  avg_approval_days float,
  top_reject_tags   jsonb,
  channel_breakdown jsonb,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(date, client_id)
);

-- ── AUDIT LOGS ──
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  post_id     uuid REFERENCES posts(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text,
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);

-- ── INDEXES (cria só se não existir) ──
CREATE INDEX IF NOT EXISTS idx_posts_client_id   ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at  ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at  ON posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_files_post   ON post_files(post_id);
CREATE INDEX IF NOT EXISTS idx_post_files_status ON post_files(status);
CREATE INDEX IF NOT EXISTS idx_post_files_exp    ON post_files(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_feedbacks    ON file_feedbacks(file_id);
CREATE INDEX IF NOT EXISTS idx_notifications     ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_client_tokens     ON client_tokens(slug);
CREATE INDEX IF NOT EXISTS idx_insight_snapshots ON insight_snapshots(client_id, date);

-- ── COLUNAS EXTRAS (adiciona se não existir) ──
-- Garante que colunas novas existam mesmo em bancos antigos

ALTER TABLE users    ADD COLUMN IF NOT EXISTS permissions text[] DEFAULT '{}';
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS deadline_days int DEFAULT 7;
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS funnel_tag funnel_tag;
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS email_link text;
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS justificativa text;
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS resubmit_count int DEFAULT 0;
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS formats jsonb DEFAULT '{}';
ALTER TABLE post_files ADD COLUMN IF NOT EXISTS updated_badge boolean DEFAULT false;
ALTER TABLE post_files ADD COLUMN IF NOT EXISTS version int DEFAULT 1;

-- ── RLS (habilita se ainda não estiver) ──
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_feedbacks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

-- ── POLICIES (cria só se não existir) ──
DO $$ BEGIN
  CREATE POLICY "Auth read posts"      ON posts      FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth write posts"     ON posts      FOR ALL    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth read files"      ON post_files FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth write files"     ON post_files FOR ALL    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth read clients"    ON clients    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth write clients"   ON clients    FOR ALL    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth write feedbacks" ON file_feedbacks    FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth write cli_fb"    ON client_feedbacks  FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth read users"      ON users      FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth write users"     ON users      FOR ALL    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── CONFIRMAÇÃO ──
SELECT 
  'Schema aplicado com sucesso! ✅' AS status,
  COUNT(*) AS tabelas_criadas
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users','clients','client_tokens','posts','post_files',
    'file_versions','file_feedbacks','client_feedbacks',
    'notifications','email_config','insight_snapshots','audit_logs'
  );
