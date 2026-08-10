import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FIELD_POLICY_OPTIONS,
  isFieldRequired,
  isFieldVisible,
  putVisibleField,
  requiredFieldIsMissing,
} from './fieldPolicies.js'

test('field policy helpers implement hidden, optional and required consistently', () => {
  assert.deepEqual(FIELD_POLICY_OPTIONS.map(option => option.value), ['hidden', 'optional', 'required'])
  assert.equal(isFieldVisible('hidden'), false)
  assert.equal(isFieldVisible('optional'), true)
  assert.equal(isFieldVisible('required'), true)
  assert.equal(isFieldRequired('required'), true)
  assert.equal(isFieldRequired('optional'), false)
  assert.equal(requiredFieldIsMissing('required', '  '), true)
  assert.equal(requiredFieldIsMissing('required', 'value'), false)
  assert.equal(requiredFieldIsMissing('optional', ''), false)
})

test('hidden fields are omitted from payloads while visible empty values remain deliberate', () => {
  const payload = { invariant: 'kept' }
  putVisibleField(payload, 'hidden', 'historical-value', 'hidden')
  putVisibleField(payload, 'optional', '', 'optional')
  putVisibleField(payload, 'required', 'value', 'required')
  assert.deepEqual(payload, { invariant: 'kept', optional: '', required: 'value' })
})
