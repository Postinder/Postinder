export type ClientDocumentType = 'cpf' | 'cnpj'

export class ClientInputValidationError extends Error {
  constructor(message: 'Invalid client document' | 'Invalid approval deadline') {
    super(message)
    this.name = 'ClientInputValidationError'
  }
}

function onlyDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '')
}

function hasOnlyDocumentFormatting(value: unknown) {
  return /^[\d.\-/\s]*$/.test(String(value ?? ''))
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value)
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value)
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false

  const calculateDigit = (length: number) => {
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

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value)
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false

  const calculateDigit = (length: 12 | 13) => {
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

export function normalizeClientDocument(
  typeValue: unknown,
  numberValue: unknown,
): { document_type: ClientDocumentType | null; document_number: string | null } {
  const documentNumber = onlyDigits(numberValue)

  // The type selector remains populated in the UI even when the optional
  // document is blank. Persist an empty document as a coherent NULL pair.
  if (!documentNumber) {
    return { document_type: null, document_number: null }
  }

  const documentType = String(typeValue ?? '').trim().toLowerCase()
  if (
    !hasOnlyDocumentFormatting(numberValue)
    || (documentType !== 'cpf' && documentType !== 'cnpj')
    || (documentType === 'cpf' && !isValidCpf(documentNumber))
    || (documentType === 'cnpj' && !isValidCnpj(documentNumber))
  ) {
    throw new ClientInputValidationError('Invalid client document')
  }

  return {
    document_type: documentType,
    document_number: documentNumber,
  }
}

export function normalizeDeadlineDays(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined

  const deadlineDays = Number(value)
  if (!Number.isInteger(deadlineDays) || deadlineDays < 1) {
    throw new ClientInputValidationError('Invalid approval deadline')
  }

  return deadlineDays
}

export function requiredClientFieldMissing(value: unknown) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)
}
