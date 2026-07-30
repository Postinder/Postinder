import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const managePostsSource = readFileSync(new URL('./ManagePostsPage.jsx', import.meta.url), 'utf8')

test('post list strengthens secondary text hierarchy in dark mode', () => {
  assert.match(managePostsSource, /text-neutral-500 dark:text-neutral-300/)
  assert.match(managePostsSource, /text-neutral-400 dark:text-neutral-300\/80/)
  assert.match(managePostsSource, /text-violet-500 dark:text-violet-300/)
  assert.match(managePostsSource, /dark:disabled:opacity-60/)
})

test('post channel chips and actions remain distinct in dark mode', () => {
  assert.match(managePostsSource, /dark:ring-neutral-700\/70/)
  assert.match(managePostsSource, /dark:hover:text-mag-200/)
  assert.match(managePostsSource, /dark:hover:text-teal-100/)
  assert.match(managePostsSource, /dark:hover:text-blue-300/)
  assert.match(managePostsSource, /dark:hover:text-green-300/)
  assert.match(managePostsSource, /dark:hover:text-amber-300/)
  assert.match(managePostsSource, /dark:hover:text-red-300/)
})
