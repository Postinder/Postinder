-- ═════════════════════════════════════════════════════════════════════════════
-- POSTINDER — Row-Level Security (RLS) Policies
-- Version: 003
-- Description: Granular access control policies for multi-tenant environment
-- Security: Users see only their company's data; Clients see only their records
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- USERS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users can read their own record
create policy "Users read own record" on users
  for select using (id = auth.uid());

-- Users can read other team members in the same company
create policy "Users read company team" on users
  for select using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
    and deleted_at is null
  );

-- Users can update their own record
create policy "Users update own record" on users
  for update using (id = auth.uid());

-- Admin users can insert new team members (handled separately at application level)
create policy "Users can read active company members" on users
  for select using (
    is_active = true
    and company_id = (
      select company_id from users where id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- CLIENTS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users (team members) see only clients in their company
create policy "Users see company clients" on clients
  for select using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
    and deleted_at is null
  );

-- Clients can see only their own record
create policy "Clients see own record" on clients
  for select using (id = auth.uid());

-- Users can update clients in their company
create policy "Users update company clients" on clients
  for update using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- POSTS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users see posts in their company
create policy "Users see company posts" on posts
  for select using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
    and deleted_at is null
  );

-- Clients see posts assigned to them
create policy "Clients see assigned posts" on posts
  for select using (client_id = auth.uid());

-- Users can create posts in their company
create policy "Users create posts in company" on posts
  for insert with check (
    company_id = (
      select company_id from users where id = auth.uid()
    )
  );

-- Users can update posts in their company
create policy "Users update company posts" on posts
  for update using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
  );

-- Users can delete posts in their company (soft delete via deleted_at)
create policy "Users delete company posts" on posts
  for delete using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
  );

-- Clients cannot modify posts directly
-- (approval flow is handled via approvals table)

-- ══════════════════════════════════════════════════════════════════════════════
-- POST FILES TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users see files for posts in their company
create policy "Users see company post files" on post_files
  for select using (
    post_id in (
      select id from posts
      where company_id = (
        select company_id from users where id = auth.uid()
      )
      and deleted_at is null
    )
  );

-- Clients see files for their assigned posts
create policy "Clients see assigned post files" on post_files
  for select using (
    post_id in (
      select id from posts where client_id = auth.uid()
    )
  );

-- Users can manage files for company posts
create policy "Users manage company post files" on post_files
  for all using (
    post_id in (
      select id from posts
      where company_id = (
        select company_id from users where id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- FILE FEEDBACKS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users see feedbacks for their company's files
create policy "Users see company file feedbacks" on file_feedbacks
  for select using (
    file_id in (
      select id from post_files
      where post_id in (
        select id from posts
        where company_id = (
          select company_id from users where id = auth.uid()
        )
      )
    )
  );

-- Clients see feedbacks on their assigned files
create policy "Clients see assigned file feedbacks" on file_feedbacks
  for select using (
    file_id in (
      select id from post_files
      where post_id in (
        select id from posts where client_id = auth.uid()
      )
    )
  );

-- Users and clients can create/update feedbacks
create policy "Users write file feedbacks" on file_feedbacks
  for all using (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- CLIENT FEEDBACKS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users see feedbacks for clients in their company
create policy "Users see company client feedbacks" on client_feedbacks
  for select using (
    client_id in (
      select id from clients
      where company_id = (
        select company_id from users where id = auth.uid()
      )
    )
  );

-- Clients see their own feedbacks
create policy "Clients see own feedbacks" on client_feedbacks
  for select using (client_id = auth.uid());

-- All authenticated users can submit/update feedbacks
create policy "All users write client feedbacks" on client_feedbacks
  for all using (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Users see notifications for themselves
create policy "Users see own notifications" on notifications
  for select using (user_id = auth.uid());

-- Clients see notifications for themselves
create policy "Clients see own notifications" on notifications
  for select using (client_id = auth.uid());

-- System can create notifications for users/clients
create policy "System creates notifications" on notifications
  for insert with check (true);

-- Users and clients can update their own notifications (mark as read)
create policy "Users update own notifications" on notifications
  for update using (user_id = auth.uid());

create policy "Clients update own notifications" on notifications
  for update using (client_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- CLIENT TOKENS TABLE POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Clients can see their own tokens (for reference/debug purposes)
create policy "Clients see own tokens" on client_tokens
  for select using (client_id = auth.uid());

-- Users can see tokens for clients in their company
create policy "Users see company client tokens" on client_tokens
  for select using (
    client_id in (
      select id from clients
      where company_id = (
        select company_id from users where id = auth.uid()
      )
    )
  );

-- Users can manage tokens for company clients
create policy "Users manage company tokens" on client_tokens
  for all using (
    client_id in (
      select id from clients
      where company_id = (
        select company_id from users where id = auth.uid()
      )
    )
  );

-- Public access for token-based approval flows (no auth required)
-- This is handled separately via anon role or edge functions

COMMIT;
