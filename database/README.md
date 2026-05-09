# Database Migrations

This directory contains SQL migrations for Postinder's Supabase database schema evolution.

## Overview

Migrations are organized chronologically and should be executed in order:

1. **001_initial_schema.sql** - Core database schema (tables, enums, indexes)
2. **002_add_company_tenant.sql** - Multi-tenant company structure
3. **003_rls_policies_granular.sql** - Row-level security policies with granular access control

## How to Run Migrations in Supabase

### Prerequisites

- Access to your Supabase project dashboard
- Admin privileges in the SQL editor

### Execution Steps

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open the migration file in your editor
5. Copy the entire contents
6. Paste into the Supabase SQL editor
7. Click **Run** or press `Ctrl+Enter`
8. Wait for execution to complete (watch for green checkmark)
9. Repeat for each migration file in numerical order

### Important Notes

- Always execute migrations in numerical order
- Run each migration in a separate query (do not concatenate them)
- Each migration is wrapped in `BEGIN/COMMIT` for transactional safety
- If a migration fails, the entire transaction is rolled back
- Check for error messages in the results panel before proceeding to the next migration

### Monitoring

After each migration:
- Check the "Results" tab for completion status
- Verify no errors were reported
- You can inspect the schema in **Table Editor** to confirm changes

## Rollback

If you need to rollback migrations:

1. **001** - Cannot be rolled back without losing all data
2. **002** - Remove the added columns and indexes manually
3. **003** - Drop the created policies using `DROP POLICY` statements

For production environments, consider implementing a migration tracking table to manage versions systematically.

## Additional Resources

- [Supabase SQL Editor Documentation](https://supabase.com/docs/guides/database/sql-editor)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/)
