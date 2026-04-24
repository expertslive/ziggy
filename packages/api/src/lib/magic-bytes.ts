export type AllowedImageType = 'image/jpeg' | 'image/png' | 'image/webp'

const JPEG = [0xff, 0xd8, 0xff]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const RIFF = [0x52, 0x49, 0x46, 0x46]
const WEBP = [0x57, 0x45, 0x42, 0x50]

function startsWith(view: Uint8Array, prefix: number[]): boolean {
  if (view.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) if (view[i] !== prefix[i]) return false
  return true
}

function hasAt(view: Uint8Array, offset: number, bytes: number[]): boolean {
  if (view.length < offset + bytes.length) return false
  for (let i = 0; i < bytes.length; i++) if (view[offset + i] !== bytes[i]) return false
  return true
}

export function detectImageType(buf: ArrayBuffer): AllowedImageType | null {
  const view = new Uint8Array(buf)
  if (startsWith(view, JPEG)) return 'image/jpeg'
  if (startsWith(view, PNG)) return 'image/png'
  if (startsWith(view, RIFF) && hasAt(view, 8, WEBP)) return 'image/webp'
  return null
}

export function extensionFor(type: AllowedImageType): string {
  switch (type) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
  }
}
