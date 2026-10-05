import assert from 'node:assert/strict'
import test from 'node:test'
import { materialFingerprint, canonicalHash } from './MaterialFingerprint'
import { normalizePositiveFeedback } from '../../portal/domain/ReviewRound'
import { administrativeApprovalSchema } from '../application/services/AdministrativeApprovalService'

const post = { id: 'p', client_id: 'c', company_id: 'tenant', content_revision: 2,
  title: 'Título', description: ' Texto exato ', channels: ['Instagram'], formats: { a: 1, b: 2 },
  scheduled_date: '2026-10-04T12:00:00Z', funnel_tag: 'Meio', email_link: null }
const files = [{ id: 'a', sort_order: 1, url: '/a', file_type: 'IMAGE' }, { id: 'b', sort_order: 2, url: '/b', file_type: 'VIDEO' }]
const soundtrack = { id: 's', mode: 'external_reference', revision_number: 2, external_url: 'https://example.test/audio' }
const policy = { soundtrackEnabled: true, funnelVisible: true, requiredFields: ['description'] }
const hash = (p = post, f = files, s = soundtrack, settings = policy) => materialFingerprint(p, f, s, settings)

test('canonical hash sorts properties recursively and normalizes null and date values', () => {
  assert.equal(canonicalHash({ b: { z: 2, a: 1 }, a: undefined }), canonicalHash({ a: null, b: { a: 1, z: 2 } }))
  assert.equal(canonicalHash(new Date('2026-10-04T12:00:00Z')), canonicalHash('2026-10-04T12:00:00.000Z'))
  assert.match(hash(), /^[a-f0-9]{64}$/)
  assert.equal(hash(), hash({ ...post, formats: { b: 2, a: 1 } }, [...files].reverse()))
})

for (const field of ['title', 'description', 'channels', 'formats', 'scheduled_date', 'funnel_tag', 'email_link', 'client_id', 'company_id', 'content_revision']) {
  test(`fingerprint changes with material post field ${field}`, () => {
    const value = field === 'scheduled_date' ? '2026-10-05' : field === 'content_revision' ? 3 : 'changed'
    assert.notEqual(hash(), hash({ ...post, [field]: value } as any))
  })
}
for (const field of ['id', 'url', 'bucket', 'storage_path', 'mime_type', 'size_bytes', 'original_name', 'file_type', 'sort_order', 'storage_deleted_at']) {
  test(`fingerprint changes with attachment field ${field}`, () => {
    assert.notEqual(hash(), hash(post, [{ ...files[0], [field]: field === 'sort_order' ? 3 : 'changed' }, files[1]]))
  })
}
test('soundtrack version, reference and policy are material; hidden and disabled material stays excluded', () => {
  assert.notEqual(hash(), hash(post, files, { ...soundtrack, revision_number: 3 }))
  assert.notEqual(hash(), hash(post, files, { ...soundtrack, external_url: 'https://example.test/new' }))
  assert.notEqual(hash(), hash(post, files, soundtrack, { ...policy, soundtrackEnabled: false }))
  assert.equal(hash(post, files, soundtrack, { ...policy, soundtrackEnabled: false }), hash(post, files, { ...soundtrack, revision_number: 7 }, { ...policy, soundtrackEnabled: false }))
  assert.equal(hash(post, files, soundtrack, { ...policy, funnelVisible: false }), hash({ ...post, funnel_tag: 'Fundo' }, files, soundtrack, { ...policy, funnelVisible: false }))
})
test('access timestamps, review status and unrelated UI fields do not change material', () => {
  assert.equal(hash(), hash({ ...post, updated_at: new Date(), status: 'approved', read_at: new Date() } as any,
    files.map(f => ({ ...f, updated_at: new Date(), status: 'approved' })), { ...soundtrack, approval_status: 'approved' } as any))
})
test('positive feedback normalization preserves semantics and enforces the limit', () => {
  assert.equal(normalizePositiveFeedback('  Gostei!  ', 'approved', 'loved'), 'Gostei!')
  for (const value of [null, undefined, '', ' \t\n ']) assert.equal(normalizePositiveFeedback(value, 'approved', 'loved'), null)
  assert.equal(normalizePositiveFeedback('x'.repeat(5000), 'approved', 'loved')?.length, 5000)
  for (const value of ['x'.repeat(5001), {}, 2]) assert.throws(() => normalizePositiveFeedback(value, 'approved', 'loved'))
  assert.throws(() => normalizePositiveFeedback('Praise', 'approved', null))
  assert.throws(() => normalizePositiveFeedback('Praise', 'rejected', 'loved'))
})
for (const [name, value] of [['ASCII', 'x'.repeat(5000)], ['emoji', '😀'.repeat(5000)], ['mixed', 'aé😀'.repeat(1666) + 'ç😀']]) {
  test(`positive feedback limit counts Unicode code points for ${name}`, () => {
    assert.equal(Array.from(value).length, 5000)
    assert.equal(normalizePositiveFeedback(value, 'approved', 'loved'), value)
    assert.throws(() => normalizePositiveFeedback(value + '😀', 'approved', 'loved'))
  })
}

test('administrative payload denies actor and tenant spoofing and requires explicit material identity', () => {
  const payload = { justification: ' Correção ', expectedRevision: 1, expectedFingerprint: 'a'.repeat(64), idempotencyKey: '10000000-0000-4000-8000-000000000001' }
  assert.equal(administrativeApprovalSchema.parse(payload).justification, 'Correção')
  for (const field of ['actorId', 'role', 'companyId', 'approvalSource']) assert.equal(administrativeApprovalSchema.safeParse({ ...payload, [field]: 'admin' }).success, false)
  assert.equal(administrativeApprovalSchema.safeParse({ ...payload, justification: '   ' }).success, false)
  assert.equal(administrativeApprovalSchema.safeParse({ ...payload, expectedRevision: 0 }).success, false)
})
