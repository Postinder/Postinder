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

test('client creation and editing follow the configurable document policy', () => {
  const createHandler = clientsPageSource.slice(
    clientsPageSource.indexOf('async function handleCreate'),
    clientsPageSource.indexOf('async function handleEdit'),
  )
  assert.match(createHandler, /buildClientDocumentPayload\(form\)/)
  assert.match(clientsPageSource, /isFieldVisible\(fieldPolicies\.document\)/)
  assert.match(clientsPageSource, /putVisibleField\(payload, 'deadline_days', form\.deadlineDays, fieldPolicies\.deadline_days\)/)
  assert.match(clientsPageSource, /putVisibleField\(payload, 'deadline_days', 7, fieldPolicies\.deadline_days\)/)
  assert.match(clientsPageSource, /editClient\.document_number/)
  assert.match(clientsPageSource, /formatClientDocument\(editClient\.document_number/)
})

test('client form validates the optional document before submission', () => {
  assert.match(clientsPageSource, /isFieldVisible\(fieldPolicies\.document\) && !isOptionalClientDocumentValid\(form\.documentType, form\.document\)/)
  assert.match(clientsPageSource, /CPF\/CNPJ inválido\./)
})

test('client details recover the active link and separate replacement from copying', () => {
  assert.match(clientDetailsSource, /fetchClientPortalLink\(id\)/)
  assert.match(clientDetailsSource, /handleCopyPortalLink/)
  assert.match(clientDetailsSource, /handleOpenPortalLink/)
  assert.match(clientDetailsSource, /handleReplacePortalLink/)
  assert.match(clientDetailsSource, /confirm\('Substituir o link ativo/)
  assert.match(clientDetailsSource, /portal_mode_override: portalMode/)
  assert.match(clientDetailsSource, /Usar configuracao da plataforma/)
  assert.match(clientDetailsSource, /Portal simplificado/)
  assert.match(clientDetailsSource, /Portal detalhado/)
})
