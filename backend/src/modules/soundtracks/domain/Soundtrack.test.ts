import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { normalizeSoundtrackInput, soundtrackAdjustmentSchema, soundtrackInputSchema } from '../application/dtos/SoundtrackDTO'
import { derivePostApprovalStatus, soundtrackRequiresApproval } from './Soundtrack'

test('postagem existente sem trilha e modo none nao criam requisito', () => {
  assert.equal(soundtrackRequiresApproval(null), false)
  assert.equal(soundtrackRequiresApproval('none'), false)
  assert.equal(derivePostApprovalStatus({ pendingFiles: 0, rejectedFiles: 0, totalFiles: 0 }), null)
})

test('as quatro modalidades sao aceitas e normalizadas explicitamente', () => {
  for (const mode of ['none', 'embedded', 'uploaded', 'external_reference'] as const) {
    const parsed = soundtrackInputSchema.parse({
      mode,
      ...(mode === 'external_reference' ? { trackName: 'Faixa' } : {}),
    })
    assert.equal(normalizeSoundtrackInput(parsed).mode, mode)
  }
})

test('referencia externa exige nome ou link e aceita somente HTTP(S)', () => {
  assert.equal(soundtrackInputSchema.safeParse({ mode: 'external_reference' }).success, false)
  assert.equal(soundtrackInputSchema.safeParse({ mode: 'external_reference', externalUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(soundtrackInputSchema.safeParse({ mode: 'external_reference', externalUrl: 'https://example.com/faixa' }).success, true)
})

test('ponto inicial negativo ou excessivo e rejeitado', () => {
  assert.equal(soundtrackInputSchema.safeParse({ mode: 'uploaded', startTimeSeconds: -1 }).success, false)
  assert.equal(soundtrackInputSchema.safeParse({ mode: 'uploaded', startTimeSeconds: 86401 }).success, false)
})

test('solicitacao de ajuste exige comentario', () => {
  assert.equal(soundtrackAdjustmentSchema.safeParse({ comment: '  ' }).success, false)
  assert.equal(soundtrackAdjustmentSchema.safeParse({ comment: 'Trocar o trecho inicial.' }).success, true)
})

test('trilha pendente ou em ajuste bloqueia aprovacao final', () => {
  assert.equal(derivePostApprovalStatus({ pendingFiles: 0, rejectedFiles: 0, totalFiles: 2, soundtrackStatus: 'pending' }), 'sent')
  assert.equal(derivePostApprovalStatus({ pendingFiles: 0, rejectedFiles: 0, totalFiles: 2, soundtrackStatus: 'adjustment_requested' }), 'rejected')
})

test('trilha aprovada permite aprovacao somente com os demais itens aprovados', () => {
  assert.equal(derivePostApprovalStatus({ pendingFiles: 0, rejectedFiles: 0, totalFiles: 2, soundtrackStatus: 'approved' }), 'approved')
  assert.equal(derivePostApprovalStatus({ pendingFiles: 1, rejectedFiles: 0, totalFiles: 2, soundtrackStatus: 'approved' }), 'sent')
  assert.equal(derivePostApprovalStatus({ pendingFiles: 0, rejectedFiles: 1, totalFiles: 2, soundtrackStatus: 'approved' }), 'rejected')
})

test('modo none nao adiciona bloqueio aos arquivos', () => {
  assert.equal(derivePostApprovalStatus({ pendingFiles: 0, rejectedFiles: 0, totalFiles: 1, soundtrackStatus: null }), 'approved')
})

test('falha ao remover storage fica no estado corrente sem mutar historico append-only', () => {
  const repository = readFileSync(
    path.resolve(process.cwd(), 'src/modules/soundtracks/infrastructure/repositories/SoundtrackRepository.ts'),
    'utf8',
  )
  const cleanup = repository.slice(
    repository.indexOf('private async removePreviousStorage'),
    repository.indexOf('async decide'),
  )

  assert.match(cleanup, /UPDATE post_soundtracks/)
  assert.match(cleanup, /storage_delete_error = \$2/)
  assert.doesNotMatch(cleanup, /UPDATE post_soundtrack_versions/)
  assert.match(cleanup, /Failed to persist soundtrack storage deletion error/)
})
