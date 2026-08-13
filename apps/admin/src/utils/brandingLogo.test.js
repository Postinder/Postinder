import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_BRANDING_LOGO_SIZE, validateBrandingLogo, versionBrandingLogoUrl } from './brandingLogo.js'

test('branding selection validates empty, size, MIME and extension before upload', () => {
  assert.match(validateBrandingLogo(null), /Selecione/)
  assert.match(validateBrandingLogo({ name: 'logo.png', type: 'image/png', size: 0 }), /nao vazia/)
  assert.match(validateBrandingLogo({ name: 'logo.png', type: 'image/png', size: MAX_BRANDING_LOGO_SIZE + 1 }), /2 MB/)
  assert.match(validateBrandingLogo({ name: 'logo.svg', type: 'image/svg+xml', size: 100 }), /PNG, JPEG ou WebP/)
  assert.match(validateBrandingLogo({ name: 'logo.png', type: 'image/jpeg', size: 100 }), /extensao correspondente/)
  assert.equal(validateBrandingLogo({ name: 'logo.JPEG', type: 'image/jpeg', size: 100 }), null)
  assert.equal(validateBrandingLogo({ name: 'logo.webp', type: 'image/webp', size: 100 }), null)
})

test('branding cache version is stable and changes only with the server version', () => {
  assert.equal(versionBrandingLogoUrl('/uploads/branding/logo/id.png', 4), '/uploads/branding/logo/id.png?v=4')
  assert.equal(versionBrandingLogoUrl('https://cdn.test/id.png?width=200', 5), 'https://cdn.test/id.png?width=200&v=5')
  assert.equal(versionBrandingLogoUrl('/logo.png', 4), versionBrandingLogoUrl('/logo.png', 4))
  assert.notEqual(versionBrandingLogoUrl('/logo.png', 4), versionBrandingLogoUrl('/logo.png', 5))
})
