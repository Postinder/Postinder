import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/postinder_platform_settings'
process.env.JWT_SECRET = 'platform-settings-test-secret'
process.env.LOG_LEVEL = 'error'

import {
  DEFAULT_PLATFORM_SETTINGS,
  mergePlatformSettings,
  platformSettingsPatchSchema,
  resolvePortalSettings,
} from './domain/PlatformSettings'
import { PlatformSettingsService } from './application/PlatformSettingsService'
import { applyPostFieldPolicies } from '../posts/presentation/controllers/PostsController'

test('platform settings domain owns safe installation defaults', () => {
  assert.equal(DEFAULT_PLATFORM_SETTINGS.retention.executed_attachment_hours, 24)
  assert.equal(DEFAULT_PLATFORM_SETTINGS.features.soundtrack, false)
  assert.deepEqual(DEFAULT_PLATFORM_SETTINGS.client_fields, {
    whatsapp: 'optional',
    segment: 'optional',
    deadline_days: 'optional',
    document: 'hidden',
  })
  assert.deepEqual(DEFAULT_PLATFORM_SETTINGS.post_fields, {
    description: 'optional',
    scheduled_date: 'optional',
    funnel_tag: 'hidden',
  })
  assert.deepEqual(DEFAULT_PLATFORM_SETTINGS.portal, {
    show_post_list: false,
    show_supplementary_info: false,
    sequential_approval: true,
    approval_mode: 'content',
  })
})

test('strict patch schema accepts partial known settings and rejects invalid or arbitrary values', () => {
  assert.deepEqual(platformSettingsPatchSchema.parse({ features: { soundtrack: true } }), {
    features: { soundtrack: true },
  })
  for (const input of [
    {},
    { retention: { executed_attachment_hours: 0 } },
    { retention: { executed_attachment_hours: 8761 } },
    { retention: { executed_attachment_hours: 2.5 } },
    { features: { soundtrack: 'yes' } },
    { client_fields: { unknown: 'optional' } },
    { post_fields: { description: 'sometimes' } },
    { portal: { approval_mode: 'file' } },
    { arbitrary: true },
  ]) {
    assert.equal(platformSettingsPatchSchema.safeParse(input).success, false)
  }
})

test('partial updates preserve every unrelated setting', () => {
  const updated = mergePlatformSettings(DEFAULT_PLATFORM_SETTINGS, {
    retention: { executed_attachment_hours: 48 },
    client_fields: { whatsapp: 'required' },
  })
  assert.equal(updated.retention.executed_attachment_hours, 48)
  assert.equal(updated.client_fields.whatsapp, 'required')
  assert.equal(updated.client_fields.document, 'hidden')
  assert.deepEqual(updated.features, DEFAULT_PLATFORM_SETTINGS.features)
  assert.deepEqual(updated.portal, DEFAULT_PLATFORM_SETTINGS.portal)
})

test('portal resolution centralizes global inheritance and explicit client overrides', () => {
  const globalDetailed = {
    show_post_list: true,
    show_supplementary_info: true,
    sequential_approval: false,
    approval_mode: 'item' as const,
  }
  assert.deepEqual(resolvePortalSettings(globalDetailed, null), globalDetailed)
  assert.deepEqual(resolvePortalSettings(globalDetailed, 'simplified'), {
    show_post_list: false,
    show_supplementary_info: false,
    sequential_approval: true,
    approval_mode: 'item',
  })
  assert.deepEqual(resolvePortalSettings(DEFAULT_PLATFORM_SETTINGS.portal, 'detailed'), {
    ...globalDetailed,
    approval_mode: 'content',
  })
  assert.deepEqual(
    resolvePortalSettings({ ...globalDetailed, sequential_approval: true }, 'simplified'),
    resolvePortalSettings(globalDetailed, 'simplified'),
  )
})

test('service delegates a validated partial patch to one atomic repository update', async () => {
  const calls: any[] = []
  const expected = { ...DEFAULT_PLATFORM_SETTINGS, features: { soundtrack: true }, updated_at: 'now' }
  const service = new PlatformSettingsService({
    async find() {
      return { ...DEFAULT_PLATFORM_SETTINGS, updated_at: null }
    },
    async update(patch: any) {
      calls.push(patch)
      return expected
    },
  } as any)
  assert.deepEqual(await service.get(), { ...DEFAULT_PLATFORM_SETTINGS, updated_at: null })
  assert.equal(await service.update({ features: { soundtrack: true } }), expected)
  assert.deepEqual(calls, [{ features: { soundtrack: true } }])
  await assert.rejects(() => service.update({ features: { soundtrack: 'invalid' } }))
  assert.equal(calls.length, 1)
})

test('migration and repository enforce one additive singleton and an atomic merge', () => {
  const migration = readFileSync(path.resolve(process.cwd(), '../database/migrations/019_platform_settings.sql'), 'utf8')
  const approvalMigration = readFileSync(path.resolve(process.cwd(), '../database/migrations/020_portal_approval_mode_and_review_drafts.sql'), 'utf8')
  const repository = readFileSync(path.resolve(process.cwd(), 'src/modules/platformSettings/infrastructure/repositories/PlatformSettingsRepository.ts'), 'utf8')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_settings/)
  assert.match(migration, /singleton_key BOOLEAN PRIMARY KEY[^\n]*CHECK \(singleton_key\)/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS portal_mode_override/)
  assert.match(migration, /BETWEEN 1 AND 8760/)
  assert.match(migration, /client_field_policies - ARRAY\['whatsapp', 'segment', 'deadline_days', 'document'\] = '\{\}'::jsonb/)
  assert.match(migration, /post_field_policies - ARRAY\['description', 'scheduled_date', 'funnel_tag'\] = '\{\}'::jsonb/)
  assert.match(migration, /client_field_policies->>'whatsapp' IN \('hidden', 'optional', 'required'\)/)
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i)
  assert.doesNotMatch(migration, /UPDATE\s+(clients|posts)/i)
  assert.match(repository, /pg_advisory_xact_lock/)
  assert.match(repository, /SELECT \* FROM platform_settings[\s\S]*mergePlatformSettings[\s\S]*ON CONFLICT \(singleton_key\)/)
  assert.match(approvalMigration, /portal_approval_mode VARCHAR\(20\) NOT NULL DEFAULT 'content'/)
  assert.match(approvalMigration, /portal_approval_mode IN \('content', 'item'\)/)
  assert.match(repository, /row\.portal_approval_mode === 'item' \? 'item' : 'content'/)
})

test('post field policies omit hidden input, allow optional blanks and enforce required effective values', () => {
  const hidden = mergePlatformSettings(DEFAULT_PLATFORM_SETTINGS, {
    post_fields: { description: 'hidden', scheduled_date: 'hidden', funnel_tag: 'hidden' },
  })
  const invariantInput = {
    title: 'Titulo',
    clientId: '00000000-0000-4000-8000-000000000001',
    channels: ['Instagram/Facebook'],
    description: 'historical',
    scheduled_date: '2026-08-20',
    funnelTag: 'topo',
  }
  assert.deepEqual(applyPostFieldPolicies(invariantInput, hidden), {
    title: invariantInput.title,
    clientId: invariantInput.clientId,
    channels: invariantInput.channels,
  })

  const required = mergePlatformSettings(DEFAULT_PLATFORM_SETTINGS, {
    post_fields: { description: 'required', scheduled_date: 'required', funnel_tag: 'required' },
  })
  assert.throws(() => applyPostFieldPolicies({ title: 'Titulo' }, required), /description is required/)
  assert.doesNotThrow(() => applyPostFieldPolicies(
    { title: 'Novo titulo' },
    required,
    { description: 'Atual', scheduledDate: '2026-08-20', funnelTag: 'topo' },
  ))
  assert.doesNotThrow(() => applyPostFieldPolicies({ description: '' }, DEFAULT_PLATFORM_SETTINGS))
})

test('disabled soundtrack rejects future mutations while historical reads remain available', async () => {
  const { SoundtracksController } = await import('../soundtracks/presentation/controllers/SoundtracksController')
  let reads = 0
  let writes = 0
  const repository = {
    async findByPostId() { reads += 1; return { mode: 'uploaded', trackName: 'Historica' } },
    async save() { writes += 1; return null },
  }
  const controller = new SoundtracksController(repository as any, {} as any, {
    async get() { return { ...DEFAULT_PLATFORM_SETTINGS, updated_at: null } },
  } as any)
  const state: any = { body: null }
  const response = { json(value: any) { state.body = value; return response } }
  await controller.get({ params: { id: 'post-1' } } as any, response as any)
  assert.equal(reads, 1)
  assert.equal(state.body.data.trackName, 'Historica')
  await assert.rejects(
    () => controller.update({ params: { id: 'post-1' }, body: { mode: 'none' } } as any, response as any),
    (error: any) => error.statusCode === 409 && error.code === 'SOUNDTRACK_DISABLED',
  )
  assert.equal(writes, 0)
})

test('portal status recalculation includes soundtrack only when the global feature is enabled', () => {
  const repository = readFileSync(path.resolve(process.cwd(), 'src/modules/portal/infrastructure/repositories/PortalRepository.ts'), 'utf8')
  assert.match(repository, /includeSoundtrack: settings\.features\.soundtrack/)
  assert.match(repository, /settings\.features\.soundtrack[\s\S]*findByPostIds/)
  assert.match(repository, /decision === 'approved' && settings\.features\.soundtrack[\s\S]*FROM post_soundtracks/)
})

test('disabled soundtrack does not mutate or block ordinary post operations', () => {
  const controller = readFileSync(path.resolve(process.cwd(), 'src/modules/posts/presentation/controllers/PostsController.ts'), 'utf8')
  const repository = readFileSync(path.resolve(process.cwd(), 'src/modules/posts/infrastructure/repositories/PostRepository.ts'), 'utf8')
  assert.match(controller, /removeFile\([\s\S]*settings\.features\.soundtrack/)
  assert.match(controller, /duplicate\([\s\S]*settings\.features\.soundtrack/)
  assert.match(controller, /submitForApproval\([\s\S]*settings\.features\.soundtrack/)
  assert.match(repository, /enforceSoundtrackSource && await this\.soundtrackRepository\.isEmbeddedSource/)
  assert.match(repository, /const originalSoundtrack = includeSoundtrack \? await client\.query/)
  assert.match(repository, /if \(includeSoundtrack\) await client\.query\([\s\S]*UPDATE post_soundtracks/)
})
