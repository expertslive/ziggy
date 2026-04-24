import { describe, it, expect } from 'vitest'
import { detectImageType, extensionFor } from './magic-bytes.js'

describe('detectImageType', () => {
  it('detects JPEG', () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(detectImageType(buf.buffer)).toBe('image/jpeg')
  })

  it('detects PNG', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(detectImageType(buf.buffer)).toBe('image/png')
  })

  it('detects WebP', () => {
    const buf = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ])
    expect(detectImageType(buf.buffer)).toBe('image/webp')
  })

  it('rejects SVG (text content)', () => {
    const svg = new TextEncoder().encode('<?xml version="1.0"?><svg/>')
    expect(detectImageType(svg.buffer as ArrayBuffer)).toBeNull()
  })

  it('rejects GIF', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectImageType(gif.buffer)).toBeNull()
  })

  it('rejects too-short buffer', () => {
    expect(detectImageType(new Uint8Array([0x00]).buffer)).toBeNull()
  })
})

describe('extensionFor', () => {
  it('maps types to extensions', () => {
    expect(extensionFor('image/jpeg')).toBe('.jpg')
    expect(extensionFor('image/png')).toBe('.png')
    expect(extensionFor('image/webp')).toBe('.webp')
  })
})
