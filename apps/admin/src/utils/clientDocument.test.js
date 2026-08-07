import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildClientDocumentPayload,
  formatClientDocument,
  isOptionalClientDocumentValid,
  onlyClientDocumentDigits,
} from './clientDocument.js'

test('formats CPF and CNPJ for input and presentation', () => {
  assert.equal(formatClientDocument('52998224725', 'cpf'), '529.982.247-25')
  assert.equal(formatClientDocument('04252011000110', 'cnpj'), '04.252.011/0001-10')
  assert.equal(formatClientDocument('529982', 'cpf'), '529.982')
})

test('validates optional CPF/CNPJ before submission', () => {
  assert.equal(isOptionalClientDocumentValid('cpf', ''), true)
  assert.equal(isOptionalClientDocumentValid('cpf', '529.982.247-25'), true)
  assert.equal(isOptionalClientDocumentValid('cpf', '529.982.247-24'), false)
  assert.equal(isOptionalClientDocumentValid('cnpj', '04.252.011/0001-10'), true)
  assert.equal(isOptionalClientDocumentValid('cnpj', '04.252.011/0001-11'), false)
  assert.equal(isOptionalClientDocumentValid('cpf', '04.252.011/0001-10'), false)
})

test('builds the official API document payload for creation and editing', () => {
  assert.deepEqual(buildClientDocumentPayload({
    documentType: 'cpf',
    document: '529.982.247-25',
  }), {
    document_type: 'cpf',
    document_number: '52998224725',
  })
  assert.deepEqual(buildClientDocumentPayload({
    documentType: 'cnpj',
    document: '04.252.011/0001-10',
  }), {
    document_type: 'cnpj',
    document_number: '04252011000110',
  })
})

test('builds an explicit NULL pair when a saved document is removed', () => {
  assert.deepEqual(buildClientDocumentPayload({
    documentType: 'cpf',
    document: '',
  }), {
    document_type: null,
    document_number: null,
  })
})

test('normalizes absent values without producing undefined', () => {
  assert.equal(onlyClientDocumentDigits(undefined), '')
  assert.equal(formatClientDocument(undefined, 'cpf'), '')
  assert.deepEqual(buildClientDocumentPayload({}), {
    document_type: null,
    document_number: null,
  })
})
