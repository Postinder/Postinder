import assert from 'node:assert/strict'
import test from 'node:test'
import { isDemoDeploymentMode } from './deploymentMode.js'

test('frontend shows demo-only controls exclusively for the exact demo mode', () => {
  assert.equal(isDemoDeploymentMode('demo'), true)
  assert.equal(isDemoDeploymentMode('production'), false)
  assert.equal(isDemoDeploymentMode(undefined), false)
  assert.equal(isDemoDeploymentMode(''), false)
  assert.equal(isDemoDeploymentMode('DEMO'), false)
  assert.equal(isDemoDeploymentMode(' demo'), false)
  assert.equal(isDemoDeploymentMode('true'), false)
})
