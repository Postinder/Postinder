import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const portalDirectory = new URL('.', import.meta.url)
const portalHeaderSource = readFileSync(new URL('./PortalHeader.jsx', import.meta.url), 'utf8')
const portalPageSource = readFileSync(new URL('./ClientPortalPage.jsx', import.meta.url), 'utf8')
const portalBrandSource = readFileSync(new URL('./portalBrand.css', import.meta.url), 'utf8')
const portalReviewActionsSource = readFileSync(new URL('./PortalReviewActions.jsx', import.meta.url), 'utf8')
const portalContentSelectorSource = readFileSync(new URL('./PortalContentSelector.jsx', import.meta.url), 'utf8')
const portalStatusSource = readFileSync(new URL('./portalStatus.js', import.meta.url), 'utf8')
const adminLayoutSource = readFileSync(new URL('../../components/layout/AdminLayout.jsx', import.meta.url), 'utf8')
const institutionalBrandSource = readFileSync(new URL('../../components/branding/InstitutionalBrand.jsx', import.meta.url), 'utf8')
const brandingProviderSource = readFileSync(new URL('../../components/branding/BrandingProvider.jsx', import.meta.url), 'utf8')
const portalComponentSource = readdirSync(portalDirectory)
  .filter(fileName => fileName.endsWith('.jsx'))
  .map(fileName => readFileSync(new URL(fileName, portalDirectory), 'utf8'))
  .join('\n')

test('portal and admin use the shared dynamic institutional brand', () => {
  assert.match(portalHeaderSource, />Portal de revisão</)
  assert.match(portalHeaderSource, /<InstitutionalBrand/)
  assert.match(adminLayoutSource, /<InstitutionalBrand/)
  assert.doesNotMatch(portalHeaderSource, /<svg/)
  assert.doesNotMatch(adminLayoutSource, /Logo20Cinco/)
  assert.match(portalHeaderSource, /text-white\/70/)
  assert.match(portalHeaderSource, /portal-theme-toggle/)
})

test('shared brand preserves layout and falls back when configuration or image loading fails', () => {
  assert.match(institutionalBrandSource, /object-contain/)
  assert.match(institutionalBrandSource, /onError=\{\(\) => setImageFailed\(true\)\}/)
  assert.match(institutionalBrandSource, /Post<span className="text-mag-500">inder/)
  assert.match(institutionalBrandSource, /alt=\{`Logo institucional/)
  assert.match(brandingProviderSource, /fetchBranding/)
  assert.match(brandingProviderSource, /catch\(\(\) => setBranding\(FALLBACK_BRANDING\)\)/)
  assert.match(adminLayoutSource, /Postinder v2\.0/)
  assert.doesNotMatch(adminLayoutSource, /portal-brand/)
})

test('admin sidebar preserves the magenta identity in both themes', () => {
  assert.match(adminLayoutSource, /bg-mag-600 dark:bg-mag-700/)
  assert.doesNotMatch(adminLayoutSource, /bg-mag-600 dark:bg-neutral-950/)
  assert.match(adminLayoutSource, /bg-white\/15 text-white/)
})

test('brand tokens are scoped to portal roots with distinct light and dark values', () => {
  assert.match(portalPageSource, /import '\.\/portalBrand\.css'/)
  assert.equal((portalPageSource.match(/className="portal-brand/g) || []).length, 3)
  assert.match(portalBrandSource, /^\.portal-brand\s*\{/m)
  assert.match(portalBrandSource, /^\.dark \.portal-brand\s*\{/m)
  assert.doesNotMatch(portalBrandSource, /:root/)
  assert.match(portalBrandSource, /--portal-brand-primary: #7d0038/)
  assert.match(portalBrandSource, /--portal-brand-primary-hover: #a7014b/)
  assert.match(portalBrandSource, /--portal-brand-header-background: #7d0038/)
  assert.match(portalBrandSource, /--portal-brand-header-background: #5a0029/)
  assert.match(portalBrandSource, /--portal-brand-header-border: rgb\(255 255 255 \/ 14%\)/)
  assert.match(portalBrandSource, /--portal-brand-header-border: rgb\(255 255 255 \/ 12%\)/)
  assert.doesNotMatch(portalBrandSource, /--portal-brand-logo-surface/)
  assert.doesNotMatch(portalComponentSource, /\bmag-\d/)
})

test('portal decision and status colors remain semantic', () => {
  assert.match(portalReviewActionsSource, /bg-green-600/)
  assert.match(portalReviewActionsSource, /bg-red-50/)
  assert.match(portalContentSelectorSource, /bg-amber-100/)
  assert.match(portalStatusSource, /green/)
  assert.match(portalStatusSource, /red/)
  assert.match(portalStatusSource, /amber/)
})
