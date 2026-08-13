import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./PlatformSettingsPage.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../../components/layout/AdminLayout.jsx', import.meta.url), 'utf8')
const clients = readFileSync(new URL('../clients/ClientsPage.jsx', import.meta.url), 'utf8')
const clientDetails = readFileSync(new URL('../clients/ClientDetailsPage.jsx', import.meta.url), 'utf8')
const newPost = readFileSync(new URL('../posts/NewPostPage.jsx', import.meta.url), 'utf8')
const managePosts = readFileSync(new URL('../posts/ManagePostsPage.jsx', import.meta.url), 'utf8')
const portal = readFileSync(new URL('../portal/ClientPortalPage.jsx', import.meta.url), 'utf8')

test('platform settings is a separate admin-only area with explicit save and no branding controls', () => {
  assert.match(app, /path="platform-settings"[\s\S]*RequirePermission permission="platform-settings"/)
  assert.match(layout, /\{isAdmin && <NavItem to="\/admin\/platform-settings"/)
  assert.match(page, /onClick=\{save\}/)
  assert.match(page, /disabled=\{saving\}/)
  assert.match(page, /Carregando configurações/)
  assert.match(page, /role="alert"/)
  assert.doesNotMatch(page, /Identidade visual|branding|logo/i)
})

test('the settings page exposes scoped groups, approval mode and controlled field keys', () => {
  for (const label of [
    'Operação e retenção',
    'Recursos',
    'Cadastro de clientes',
    'Criação de postagens',
    'Portal do cliente',
    'Forma de aprovação do cliente',
  ]) assert.match(page, new RegExp(label))
  for (const key of ['whatsapp', 'segment', 'deadline_days', 'document']) assert.match(page, new RegExp(`'${key}'`))
  for (const key of ['description', 'scheduled_date']) assert.match(page, new RegExp(`'${key}'`))
  assert.doesNotMatch(page, /'funnel_tag'/)
  assert.match(page, /executed_attachment_hours/)
  assert.match(page, /features\.soundtrack/)
  assert.match(page, /show_post_list/)
  assert.match(page, /show_supplementary_info/)
  assert.match(page, /sequential_approval/)
  assert.match(page, /approval_mode/)
  assert.match(page, /Aprovar o conteúdo inteiro/)
  assert.match(page, /Aprovar item por item/)
})

test('configured client fields affect create, edit, import and detail views without weakening invariants', () => {
  assert.match(clients, /Nome \*/)
  assert.match(clients, /E-mail \*/)
  assert.match(clients, /Senha \*/)
  assert.match(clients, /putVisibleField\(payload, 'whatsapp'/)
  assert.match(clients, /putVisibleField\(updates, 'segment'/)
  assert.match(clients, /requiredFieldIsMissing\(fieldPolicies\.whatsapp/)
  assert.match(clients, /VCFImport[\s\S]*fieldPolicies/)
  assert.match(clientDetails, /isFieldVisible\(fieldPolicies\.document\)/)
  assert.match(clientDetails, /portal_mode_override/)
  assert.match(clientDetails, /Usar configuracao da plataforma/)
})

test('post and portal screens consume feature and effective portal settings', () => {
  assert.match(newPost, /settings\.features\.soundtrack/)
  assert.match(newPost, /settings\.post_fields/)
  assert.match(managePosts, /settings\.features\.soundtrack/)
  assert.match(managePosts, /executed_attachment_hours/)
  assert.doesNotMatch(managePosts, /retentionPolicy/)
  assert.match(portal, /portalSettings/)
  assert.match(portal, /show_post_list/)
  assert.match(portal, /show_supplementary_info/)
  assert.match(portal, /sequential_approval/)
  assert.match(portal, /features\?\.soundtrack/)
})
