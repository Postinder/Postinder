import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clientsPageSource = readFileSync(new URL('./ClientsPage.jsx', import.meta.url), 'utf8')

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

test('client creation and editing use the official document and deadline API fields', () => {
  assert.match(clientsPageSource, /\.\.\.buildClientDocumentPayload\(form\)/)
  assert.match(clientsPageSource, /deadline_days: form\.deadlineDays/)
  assert.match(clientsPageSource, /deadline_days:7/)
  assert.match(clientsPageSource, /editClient\.document_number/)
  assert.match(clientsPageSource, /formatClientDocument\(editClient\.document_number/)
})

test('client form validates the optional document before submission', () => {
  assert.match(clientsPageSource, /isOptionalClientDocumentValid\(form\.documentType, form\.document\)/)
  assert.match(clientsPageSource, /CPF\/CNPJ inválido\./)
})
