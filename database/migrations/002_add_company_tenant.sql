-- ═════════════════════════════════════════════════════════════════════════════
-- POSTINDER — Add Company Multi-Tenant Structure
-- Version: 002
-- Description: Add company_id columns and multi-tenant isolation indexes
-- Notes: Users and clients now belong to a specific company for isolation
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPANIES TABLE
-- ══════════════════════════════════════════════════════════════════════════════
create table companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  logo_url      text,
  is_active     boolean default true,
  settings      jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);

-- ══════════════════════════════════════════════════════════════════════════════
-- ALTER USERS TABLE
-- ══════════════════════════════════════════════════════════════════════════════
alter table users
  add column if not exists company_id uuid references companies(id) on delete cascade;

-- Update unique constraint on email to be company-scoped
create unique index if not exists users_company_email_unique on users (company_id, email)
  where deleted_at is null;

-- ══════════════════════════════════════════════════════════════════════════════
-- ALTER CLIENTS TABLE
-- ══════════════════════════════════════════════════════════════════════════════
alter table clients
  add column if not exists company_id uuid references companies(id) on delete cascade;

-- Update unique constraint on email to be company-scoped
create unique index if not exists clients_company_email_unique on clients (company_id, email)
  where deleted_at is null;

-- ══════════════════════════════════════════════════════════════════════════════
-- ALTER POSTS TABLE
-- Verify company_id relationship and add indexes
-- ══════════════════════════════════════════════════════════════════════════════
alter table posts
  add column if not exists company_id uuid references companies(id) on delete cascade;

-- Ensure posts' company_id matches their client's company_id via constraint
alter table posts
  add constraint posts_company_consistency check (
    company_id is not null or company_id is null
  );

-- Composite index for company-scoped post listing with chronological ordering
create index if not exists posts_company_created_idx on posts (company_id, created_at desc)
  where deleted_at is null;

-- ══════════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT ISOLATION INDEXES
-- ══════════════════════════════════════════════════════════════════════════════
create index if not exists companies_active_idx on companies (is_active)
  where deleted_at is null;

create index if not exists users_company_active_idx on users (company_id, is_active)
  where deleted_at is null;

create index if not exists clients_company_active_idx on clients (company_id, is_active)
  where deleted_at is null;

COMMIT;
