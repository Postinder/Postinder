import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pageSource = readFileSync(new URL('./BrandingPage.jsx', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const layoutSource = readFileSync(new URL('../../components/layout/AdminLayout.jsx', import.meta.url), 'utf8')
const serviceSource = readFileSync(new URL('../../services/branding.service.js', import.meta.url), 'utf8')
const loginSource = readFileSync(new URL('../auth/LoginPage.jsx', import.meta.url), 'utf8')

test('admin branding page requires explicit confirmation and prevents concurrent actions', () => {
  assert.match(pageSource, /Previa antes de salvar/)
  assert.match(pageSource, /onClick=\{saveLogo\}/)
  assert.doesNotMatch(pageSource, /onChange=\{saveLogo\}/)
  assert.match(pageSource, /disabled=\{!file \|\| busy\}/)
  assert.match(pageSource, /disabled=\{!branding\.logoUrl \|\| busy\}/)
  assert.match(pageSource, /PNG, JPEG ou WebP, ate 2 MB/)
  assert.match(pageSource, /role="alert"/)
})

test('admin-only navigation and route expose upload and removal while portal code has no mutations', () => {
  assert.match(layoutSource, /\{isAdmin && <NavItem to="\/admin\/branding"/)
  assert.match(appSource, /path="branding"/)
  assert.match(serviceSource, /post\('\/branding\/logo'/)
  assert.match(serviceSource, /delete\('\/branding\/logo'/)
  const portalSource = readFileSync(new URL('../portal/ClientPortalPage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(portalSource, /uploadBrandingLogo|removeBrandingLogo/)
})

test('public authentication remains branded as Postinder', () => {
  assert.match(loginSource, /Post<span className="text-mag-500">inder<\/span>/)
  assert.match(loginSource, /Plataforma de Aprovação de Conteúdo/)
  assert.match(loginSource, /<Flame/)
  assert.doesNotMatch(loginSource, /InstitutionalBrand|useBranding|branding\.logoUrl/)
})
