import { pool, query } from '../../../../shared/database/pool'
import {
  DEFAULT_PLATFORM_SETTINGS,
  mergePlatformSettings,
  PlatformSettings,
  PlatformSettingsPatch,
  platformSettingsSchema,
} from '../../domain/PlatformSettings'

export type PlatformSettingsRecord = PlatformSettings & { updated_at: string | Date | null }

function mapRow(row: any): PlatformSettingsRecord {
  if (!row) return { ...DEFAULT_PLATFORM_SETTINGS, updated_at: null }
  return {
    ...platformSettingsSchema.parse({
      retention: { executed_attachment_hours: Number(row.executed_attachment_retention_hours) },
      features: { soundtrack: row.soundtrack_enabled === true },
      client_fields: row.client_field_policies,
      post_fields: row.post_field_policies,
      post_field_client_visibility: row.post_field_client_visibility
        || DEFAULT_PLATFORM_SETTINGS.post_field_client_visibility,
      portal: {
        show_post_list: row.portal_show_post_list === true,
        show_supplementary_info: row.portal_show_supplementary_info === true,
        sequential_approval: row.portal_sequential_approval === true,
        approval_mode: row.portal_approval_mode === 'item' ? 'item' : 'content',
      },
    }),
    updated_at: row.updated_at || null,
  }
}

export class PlatformSettingsRepository {
  async find(): Promise<PlatformSettingsRecord> {
    const result = await query('SELECT * FROM platform_settings WHERE singleton_key = TRUE LIMIT 1')
    return mapRow(result.rows[0])
  }

  async save(settings: PlatformSettings): Promise<PlatformSettingsRecord> {
    return this.update(settings)
  }

  async update(patch: PlatformSettingsPatch): Promise<PlatformSettingsRecord> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(90425002)')
      const currentResult = await client.query(
        'SELECT * FROM platform_settings WHERE singleton_key = TRUE LIMIT 1',
      )
      const settings = mergePlatformSettings(mapRow(currentResult.rows[0]), patch)
      const result = await client.query(
        `INSERT INTO platform_settings (
           singleton_key, executed_attachment_retention_hours, soundtrack_enabled,
           client_field_policies, post_field_policies, post_field_client_visibility, portal_show_post_list,
           portal_show_supplementary_info, portal_sequential_approval, portal_approval_mode, updated_at
         ) VALUES (TRUE, $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, NOW())
         ON CONFLICT (singleton_key) DO UPDATE SET
           executed_attachment_retention_hours = EXCLUDED.executed_attachment_retention_hours,
           soundtrack_enabled = EXCLUDED.soundtrack_enabled,
           client_field_policies = EXCLUDED.client_field_policies,
           post_field_policies = EXCLUDED.post_field_policies,
           post_field_client_visibility = EXCLUDED.post_field_client_visibility,
           portal_show_post_list = EXCLUDED.portal_show_post_list,
           portal_show_supplementary_info = EXCLUDED.portal_show_supplementary_info,
           portal_sequential_approval = EXCLUDED.portal_sequential_approval,
           portal_approval_mode = EXCLUDED.portal_approval_mode,
           updated_at = NOW()
         RETURNING *`,
        [
          settings.retention.executed_attachment_hours,
          settings.features.soundtrack,
          JSON.stringify(settings.client_fields),
          JSON.stringify(settings.post_fields),
          JSON.stringify(settings.post_field_client_visibility),
          settings.portal.show_post_list,
          settings.portal.show_supplementary_info,
          settings.portal.sequential_approval,
          settings.portal.approval_mode,
        ],
      )
      await client.query('COMMIT')
      return mapRow(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }
}
