export function onlyClientDocumentDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function hasRepeatedDigits(value) {
  return /^(\d)\1+$/.test(value)
}

export function formatClientDocument(value, type = 'cpf') {
  const maxLength = type === 'cnpj' ? 14 : 11
  const digits = onlyClientDocumentDigits(value).slice(0, maxLength)

  if (type === 'cnpj') {
    if (digits.length > 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    if (digits.length > 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
    if (digits.length > 5) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
    if (digits.length > 2) return `${digits.slice(0, 2)}.${digits.slice(2)}`
    return digits
  }

  if (digits.length > 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  if (digits.length > 6) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  if (digits.length > 3) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  return digits
}

export function isValidCpf(value) {
  const digits = onlyClientDocumentDigits(value)
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false

  const calculateDigit = length => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return calculateDigit(9) === Number(digits[9])
    && calculateDigit(10) === Number(digits[10])
}

export function isValidCnpj(value) {
  const digits = onlyClientDocumentDigits(value)
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false

  const calculateDigit = length => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return calculateDigit(12) === Number(digits[12])
    && calculateDigit(13) === Number(digits[13])
}

export function isOptionalClientDocumentValid(type, value) {
  const digits = onlyClientDocumentDigits(value)
  if (!digits) return true
  if (type === 'cpf') return isValidCpf(digits)
  if (type === 'cnpj') return isValidCnpj(digits)
  return false
}

export function buildClientDocumentPayload(form) {
  const documentNumber = onlyClientDocumentDigits(form.document)
  if (!documentNumber) {
    return { document_type: null, document_number: null }
  }

  return {
    document_type: form.documentType,
    document_number: documentNumber,
  }
}
