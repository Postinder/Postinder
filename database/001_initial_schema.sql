-- ═══════════════════════════════════════════════════════════════════
-- Postinder v2.0 - Initial Database Schema
-- PostgreSQL
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create users table (admin/manager)
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

-- Create clients table (clientes da plataforma)
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

-- Create posts table
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
  approved_at TIMESTAMP
);

-- Create files table (imagens/videos dos posts)
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url VARCHAR(512) NOT NULL,
  original_name VARCHAR(255),
  file_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  rejection_reason TEXT,
  rejection_tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  rating INTEGER,
  text TEXT,
  month VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_company_id ON posts(company_id);
CREATE INDEX IF NOT EXISTS idx_files_post_id ON files(post_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_feedback_client_id ON feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);

-- Insert test users
-- Admin password: Admin@123456
INSERT INTO users (name, email, password_hash, role, permissions, is_active)
VALUES (
  'Administrador Postinder',
  'admin@postinder.local',
  '$2a$10$mZ7UBznnaEVfUJQySHYiVOq3Bc9C77zqe2z4JQG6mlPOHFU3YYPae',
  'admin',
  ARRAY['dashboard', 'clients', 'posts', 'approvals', 'insights', 'users', 'email', 'integrations'],
  true
)
ON CONFLICT (email) DO NOTHING;

-- Insert test client (password: Cliente@123456)
INSERT INTO clients (name, email, password_hash, whatsapp, segment, color, deadline_days, is_active)
VALUES (
  'Acme Corp',
  'cliente@example.com',
  '$2a$10$V7UOjiO7mSRpSHNDYdRHYOWiWqqbG3HS9I/aytMm7ZYOfYpUj7UKS',
  '(11) 99999-9999',
  'Tecnologia',
  '#A7014B',
  7,
  true
)
ON CONFLICT (email) DO NOTHING;

-- Verification query
SELECT 'USERS' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'CLIENTS' as table_name, COUNT(*) as count FROM clients;
