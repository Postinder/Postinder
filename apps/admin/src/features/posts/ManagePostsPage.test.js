import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeEmailPreviewUrl } from '../../utils/emailPreview.js'

const managePostsSource = readFileSync(new URL('./ManagePostsPage.jsx', import.meta.url), 'utf8')
const newPostSource = readFileSync(new URL('./NewPostPage.jsx', import.meta.url), 'utf8')
const constantsSource = readFileSync(new URL('../../utils/constants.js', import.meta.url), 'utf8')
const channelIconSource = readFileSync(new URL('../../components/posts/ChannelIcon.jsx', import.meta.url), 'utf8')
const feedPreviewSource = readFileSync(new URL('./FeedPreviewPage.jsx', import.meta.url), 'utf8')

test('post list strengthens secondary text hierarchy in dark mode', () => {
  assert.match(managePostsSource, /text-neutral-500 dark:text-neutral-300/)
  assert.match(managePostsSource, /text-neutral-400 dark:text-neutral-300\/80/)
  assert.match(managePostsSource, /dark:disabled:opacity-60/)
})

test('email preview accepts only trimmed HTTP URLs and remains editable with optional attachments', () => {
  assert.equal(normalizeEmailPreviewUrl('  https://example.test/preview  '), 'https://example.test/preview')
  assert.equal(normalizeEmailPreviewUrl('http://example.test'), 'http://example.test')
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'example.test']) {
    assert.equal(normalizeEmailPreviewUrl(value), null)
  }
  assert.match(newPostSource, /Link de pré-visualização do e-mail/)
  assert.match(newPostSource, /isEmailOnly/)
  assert.match(managePostsSource, /emailLink: hasEmail \? normalizedEmailLink : null/)
})

test('channel choices use controlled vector icons, remove 3A3R and preserve safe Instagram formats', () => {
  assert.doesNotMatch(constantsSource, /['"]3A3R['"]\s*:/)
  assert.doesNotMatch(constantsSource, /[📷💼🎵🎬📍📱🚀🌐📧]/u)
  assert.match(constantsSource, /formats: \['Card', 'Carrossel', 'Stories', 'Reels', 'Foto'\]/)
  assert.doesNotMatch(constantsSource, /formats: \[[^\]]*'Feed'/)
  assert.match(channelIconSource, /Instagram/)
  assert.match(channelIconSource, /Facebook/)
  assert.match(managePostsSource, /<ChannelIcon channel=\{channel\}/)
})

test('soundtrack controls follow the feature flag while attachment arrows remain', () => {
  assert.match(newPostSource, /settings\.features\.soundtrack \? \(/)
  assert.match(newPostSource, /<SoundtrackEditor/)
  assert.match(managePostsSource, /settings\.features\.soundtrack \? \(/)
  assert.match(managePostsSource, /<SoundtrackEditor/)
  assert.match(managePostsSource, /SortableAttachments/)
  assert.match(managePostsSource, /onMove=/)
  assert.doesNotMatch(feedPreviewSource, /SoundtrackEditor/)
  assert.match(feedPreviewSource, /Todos status/)
  assert.doesNotMatch(feedPreviewSource, /Todos os estados/)
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
