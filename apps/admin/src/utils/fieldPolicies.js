export const FIELD_POLICY_OPTIONS = [
  { value: 'hidden', label: 'Oculto' },
  { value: 'optional', label: 'Opcional' },
  { value: 'required', label: 'Obrigatorio' },
]

export function isFieldVisible(policy) {
  return policy !== 'hidden'
}

export function isFieldRequired(policy) {
  return policy === 'required'
}

export function requiredFieldIsMissing(policy, value) {
  return isFieldRequired(policy) && (value === undefined || value === null || String(value).trim() === '')
}

export function putVisibleField(payload, key, value, policy) {
  if (isFieldVisible(policy)) payload[key] = value
  return payload
}
