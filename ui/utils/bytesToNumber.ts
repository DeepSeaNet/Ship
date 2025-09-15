export function bytesToDisplayKey(bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes.slice(0, 16)) {
    n = (n << 8n) | BigInt(b)
  }
  const reduced = n % 10n ** 30n
  const s = reduced.toString().padStart(30, '0')
  return s.match(/.{1,5}/g)!.join(' ')
}
