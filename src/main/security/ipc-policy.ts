// Only the exact top-level application document may invoke the bridge.
export function isTrustedDocument(actual: string, expected: string): boolean {
  try {
    const a = new URL(actual)
    const b = new URL(expected)
    a.hash = ''
    b.hash = ''
    return (b.protocol === 'file:' || b.protocol === 'http:') &&
      a.href === b.href
  } catch {
    return false
  }
}
