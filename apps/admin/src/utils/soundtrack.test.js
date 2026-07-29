import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSoundtrackPayload,
  emptySoundtrackDraft,
  isSoundtrackPending,
  soundtrackHasData,
  validateSoundtrackDraft,
  validateSoundtrackFile,
} from './soundtrack.js'
import {
  applySoundtrackStartTime,
  playExclusiveSoundtrack,
  stopSoundtrack,
  toggleSoundtrackMute,
} from './soundtrackPlayback.js'

test('postagem antiga e modo none permanecem compativeis', () => {
  const draft = emptySoundtrackDraft()
  assert.equal(draft.mode, 'none')
  assert.equal(validateSoundtrackDraft(draft), null)
  assert.equal(isSoundtrackPending(null), false)
})

test('confirmacao de troca depende de dados que possam ser descartados', () => {
  assert.equal(soundtrackHasData({ ...emptySoundtrackDraft(), mode: 'external_reference' }), false)
  assert.equal(soundtrackHasData({ ...emptySoundtrackDraft(), mode: 'external_reference', trackName: 'Faixa' }), true)
  assert.equal(soundtrackHasData({ ...emptySoundtrackDraft(), mode: 'embedded', sourceMediaKey: 'video-1' }), true)
  assert.equal(soundtrackHasData({ ...emptySoundtrackDraft(), mode: 'uploaded', approvalStatus: 'approved' }), true)
})

test('embedded exige video e selecao quando ha varios', () => {
  const draft = { ...emptySoundtrackDraft(), mode: 'embedded' }
  assert.match(validateSoundtrackDraft(draft, []), /video/i)
  assert.match(validateSoundtrackDraft(draft, [{ key: '1' }, { key: '2' }]), /selecione/i)
  assert.equal(validateSoundtrackDraft({ ...draft, sourceMediaKey: '1' }, [{ key: '1' }, { key: '2' }]), null)
  assert.match(validateSoundtrackDraft({ ...draft, sourceMediaKey: 'outra-postagem' }, [{ key: '1' }]), /video ativo/i)
})

test('uploaded exige um unico arquivo ativo ou arquivo existente', () => {
  const draft = { ...emptySoundtrackDraft(), mode: 'uploaded' }
  assert.match(validateSoundtrackDraft(draft), /arquivo de audio/i)
  assert.equal(validateSoundtrackDraft({ ...draft, existingAudioFile: { url: '/audio.mp3' } }), null)
})

test('validacao do upload aceita formatos seguros e recusa excesso', () => {
  assert.equal(validateSoundtrackFile({ name: 'faixa.mp3', type: 'audio/mpeg', size: 1024 }), null)
  assert.match(validateSoundtrackFile({ name: 'faixa.exe', type: 'application/octet-stream', size: 1024 }), /use MP3/i)
  assert.match(validateSoundtrackFile({ name: 'faixa.wav', type: 'audio/wav', size: 51 * 1024 * 1024 }), /50 MB/i)
})

test('referencia externa nao inventa arquivo e valida URL', () => {
  const draft = { ...emptySoundtrackDraft(), mode: 'external_reference', trackName: 'Faixa', externalUrl: 'https://example.com' }
  assert.equal(validateSoundtrackDraft(draft), null)
  const payload = buildSoundtrackPayload(draft)
  assert.equal(payload.externalUrl, 'https://example.com')
  assert.equal('audioFile' in payload, false)
  assert.match(validateSoundtrackDraft({ ...draft, externalUrl: 'javascript:alert(1)' }), /HTTP ou HTTPS/i)
})

test('ligar ou desligar a previa nao altera qualquer decisao', () => {
  const audio = { muted: false }
  assert.equal(toggleSoundtrackMute(audio), true)
  assert.equal(toggleSoundtrackMute(audio), false)
  assert.equal('approvalStatus' in audio, false)
})

test('ponto inicial e desmontagem controlam somente o player', () => {
  const audio = { duration: 120, currentTime: 0, paused: false, pause() { this.paused = true } }
  applySoundtrackStartTime(audio, 18)
  assert.equal(audio.currentTime, 18)
  stopSoundtrack(audio)
  assert.equal(audio.paused, true)
})

test('reproducao exclusiva anuncia a trilha e exige play explicito', async () => {
  const events = []
  const target = { dispatchEvent(event) { events.push(event); return true } }
  const audio = { played: false, async play() { this.played = true } }
  await playExclusiveSoundtrack(audio, 'soundtrack-1', target)
  assert.equal(audio.played, true)
  assert.equal(events[0].detail, 'soundtrack-1')
})
