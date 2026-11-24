import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedDocument } from '../src/main/security/ipc-policy.ts'
import { parseCompact } from '../src/shared/contracts.ts'

test('IPC permits only the expected document, including hash navigation', () => {
  const file = 'file:///C:/PSSA/out/renderer/index.html'
  assert.equal(isTrustedDocument(file, file), true)
  assert.equal(isTrustedDocument(file + '#settings', file), true)
  for (const other of ['file:///C:/other.html', file + '?other=1', 'https://example.com', 'not a url']) {
    assert.equal(isTrustedDocument(other, file), false)
  }
  const dev = 'http://localhost:5173/'
  assert.equal(isTrustedDocument(dev, dev), true)
  assert.equal(isTrustedDocument('http://localhost:5174/', dev), false)
  assert.equal(isTrustedDocument('http://localhost:5173/other', dev), false)
  assert.equal(isTrustedDocument('https://example.com/', 'https://example.com/'), false)
})

test('IPC settings reject non-boolean payloads', () => {
  assert.equal(parseCompact(false), false)
  assert.equal(parseCompact(true), true)
  for (const invalid of [null, undefined, 0, 'true', {}, []]) {
    assert.throws(() => parseCompact(invalid), TypeError)
  }
})
