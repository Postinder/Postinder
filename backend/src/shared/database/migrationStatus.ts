import { pool } from './pool'
import { listStructuralMigrationFiles } from './migrationCatalog'

export type MigrationStatus = {
  applied: string[]
  pending: string[]
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const expected = await listStructuralMigrationFiles()
  const result = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations')
  const applied = result.rows.map(row => row.filename)
  const appliedSet = new Set(applied)

  return {
    applied,
    pending: expected.filter(filename => !appliedSet.has(filename)),
  }
}
