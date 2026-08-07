import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clientsPageSource = readFileSync(new URL('./ClientsPage.jsx', import.meta.url), 'utf8')
const clientDetailsSource = readFileSync(new URL('./ClientDetailsPage.jsx', import.meta.url), 'utf8')

test('client metrics keep their semantic colors with stronger dark surfaces', () => {
  for (const color of ['green', 'amber', 'red']) {
    assert.match(clientsPageSource, new RegExp(`bg-${color}-50`))
    assert.match(clientsPageSource, new RegExp(`dark:bg-${color}-900/40`))
    assert.match(clientsPageSource, new RegExp(`dark:ring-${color}-700/40`))
    assert.match(clientsPageSource, new RegExp(`dark:text-${color}-300`))
  }
})

test('client metric labels remain unchanged', () => {
  assert.match(clientsPageSource, />Aprov</)
  assert.match(clientsPageSource, />Pend</)
  assert.match(clientsPageSource, />Reprov</)
})

test('client creation omits CPF/CNPJ while editing preserves legacy document compatibility', () => {
  const createHandler = clientsPageSource.slice(
    clientsPageSource.indexOf('async function handleCreate'),
    clientsPageSource.indexOf('async function handleEdit'),
  )
  assert.doesNotMatch(createHandler, /buildClientDocumentPayload|document_type|document_number/)
  assert.match(clientsPageSource, /initial \? <div>/)
  assert.match(clientsPageSource, /\.\.\.buildClientDocumentPayload\(form\)/)
  assert.match(clientsPageSource, /deadline_days: form\.deadlineDays/)
  assert.match(clientsPageSource, /deadline_days:7/)
  assert.match(clientsPageSource, /editClient\.document_number/)
  assert.match(clientsPageSource, /formatClientDocument\(editClient\.document_number/)
})

test('client form validates the optional document before submission', () => {
  assert.match(clientsPageSource, /initial && !isOptionalClientDocumentValid\(form\.documentType, form\.document\)/)
  assert.match(clientsPageSource, /CPF\/CNPJ inválido\./)
})

test('client details recover the active link and separate replacement from copying', () => {
  assert.match(clientDetailsSource, /fetchClientPortalLink\(id\)/)
  assert.match(clientDetailsSource, /handleCopyPortalLink/)
  assert.match(clientDetailsSource, /handleOpenPortalLink/)
  assert.match(clientDetailsSource, /handleReplacePortalLink/)
  assert.match(clientDetailsSource, /confirm\('Substituir o link ativo/)
  assert.match(clientDetailsSource, /portal_detailed_view: enabled/)
  assert.match(clientDetailsSource, /Visualizacao detalhada do portal/)
})
