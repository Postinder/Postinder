export const DASHBOARD_PANELS_INITIAL_STATE = Object.freeze({
  activity: false,
  posts: false,
})

export const PORTAL_OVERVIEW_INITIAL_STATE = false

export function toggleDashboardPanel(state, panel) {
  if (!Object.hasOwn(state, panel)) return state
  return { ...state, [panel]: !state[panel] }
}

export function togglePortalOverview(expanded) {
  return !expanded
}
