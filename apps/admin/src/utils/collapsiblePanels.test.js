import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DASHBOARD_PANELS_INITIAL_STATE,
  PORTAL_OVERVIEW_INITIAL_STATE,
  toggleDashboardPanel,
  togglePortalOverview,
} from './collapsiblePanels.js'

const dashboardSource = readFileSync(new URL('../features/dashboard/DashboardPage.jsx', import.meta.url), 'utf8')
const portalSource = readFileSync(new URL('../features/portal/ClientPortalPage.jsx', import.meta.url), 'utf8')
const stateSource = readFileSync(new URL('./collapsiblePanels.js', import.meta.url), 'utf8')

test('dashboard panels start collapsed and toggle independently', () => {
  assert.deepEqual(DASHBOARD_PANELS_INITIAL_STATE, { activity: false, posts: false })

  const activityExpanded = toggleDashboardPanel(DASHBOARD_PANELS_INITIAL_STATE, 'activity')
  assert.deepEqual(activityExpanded, { activity: true, posts: false })

  const bothExpanded = toggleDashboardPanel(activityExpanded, 'posts')
  assert.deepEqual(bothExpanded, { activity: true, posts: true })

  const activityCollapsedAgain = toggleDashboardPanel(bothExpanded, 'activity')
  assert.deepEqual(activityCollapsedAgain, { activity: false, posts: true })
})

test('dashboard disclosure controls preserve semantic and mounted regions', () => {
  assert.match(dashboardSource, /useReducer\(toggleDashboardPanel, DASHBOARD_PANELS_INITIAL_STATE\)/)
  assert.match(dashboardSource, /aria-expanded=\{isActivityExpanded\}/)
  assert.match(dashboardSource, /aria-controls="dashboard-activity-content"/)
  assert.match(dashboardSource, /id="dashboard-activity-content"[\s\S]*?role="region"[\s\S]*?hidden=\{!isActivityExpanded\}/)
  assert.match(dashboardSource, /aria-expanded=\{isPostsExpanded\}/)
  assert.match(dashboardSource, /aria-controls="dashboard-posts-content"/)
  assert.match(dashboardSource, /id="dashboard-posts-content"[\s\S]*?role="region"[\s\S]*?hidden=\{!isPostsExpanded\}/)
})

test('client portal overview starts collapsed and toggles without persistence', () => {
  assert.equal(PORTAL_OVERVIEW_INITIAL_STATE, false)
  assert.equal(togglePortalOverview(PORTAL_OVERVIEW_INITIAL_STATE), true)
  assert.equal(togglePortalOverview(true), false)
  assert.doesNotMatch(stateSource, /localStorage|sessionStorage/)
  assert.match(portalSource, /useReducer\(togglePortalOverview, PORTAL_OVERVIEW_INITIAL_STATE\)/)
})

test('client portal keeps approval visible and complementary content mounted behind disclosure semantics', () => {
  const approvalIndex = portalSource.indexOf('<ProjectReviewPanel')
  const overviewRegionIndex = portalSource.indexOf('id="portal-overview-content"')
  const metricsIndex = portalSource.indexOf('<PortalMetricsBar', overviewRegionIndex)

  assert.ok(approvalIndex >= 0 && approvalIndex < overviewRegionIndex)
  assert.ok(metricsIndex > overviewRegionIndex)
  assert.match(portalSource, /aria-expanded=\{isOverviewExpanded\}/)
  assert.match(portalSource, /aria-controls="portal-overview-content"/)
  assert.match(portalSource, /id="portal-overview-content"[\s\S]*?role="region"[\s\S]*?aria-labelledby="portal-overview-title"[\s\S]*?hidden=\{!isOverviewExpanded\}/)
})
