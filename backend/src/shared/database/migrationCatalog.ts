import fs from 'fs/promises'
import path from 'path'

export const NON_STRUCTURAL_MIGRATION_FILENAMES = new Set([
  '002_development_seed.sql',
])

function migrationDirectoryCandidates() {
  return [
    path.resolve(process.cwd(), '..', 'database', 'migrations'),
    path.resolve(process.cwd(), 'database', 'migrations'),
  ]
}

export async function listStructuralMigrationFiles() {
  for (const migrationsDir of migrationDirectoryCandidates()) {
    try {
      const files = await fs.readdir(migrationsDir)
      return files
        .filter(file => file.endsWith('.sql'))
        .filter(file => !NON_STRUCTURAL_MIGRATION_FILENAMES.has(file))
        .sort()
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  throw new Error('Migration directory was not found. Expected database/migrations in the repository.')
}
