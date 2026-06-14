CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  company_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(20),
  segment VARCHAR(100),
  color VARCHAR(7),
  deadline_days INTEGER DEFAULT 7,
  company_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id UUID,
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  deleted_at TIMESTAMP,
  channels TEXT[] DEFAULT ARRAY[]::TEXT[],
  formats JSONB DEFAULT '{}'::jsonb,
  scheduled_date TIMESTAMP,
  funnel_tag VARCHAR(100),
  email_link TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  files_delete_after TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url VARCHAR(512) NOT NULL,
  original_name VARCHAR(255),
  file_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  sort_order INTEGER,
  rejection_reason TEXT,
  rejection_tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  rating INTEGER,
  text TEXT,
  month VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  actor_id UUID,
  actor_role VARCHAR(50),
  type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID NOT NULL,
  notification_id VARCHAR(255) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, notification_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE posts ADD COLUMN IF NOT EXISTS formats JSONB DEFAULT '{}'::jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS funnel_tag VARCHAR(100);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS email_link TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS files_delete_after TIMESTAMP;

ALTER TABLE files ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE files ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS rejection_tags TEXT[];

CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_company_id ON posts(company_id);
CREATE INDEX IF NOT EXISTS idx_files_post_id ON files(post_id);
CREATE INDEX IF NOT EXISTS idx_files_post_sort_order ON files(post_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_feedback_client_id ON feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_company_id ON activity_events(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_client_id ON activity_events(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_post_id ON activity_events(post_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_company_id ON notification_reads(company_id);
