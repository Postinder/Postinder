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
