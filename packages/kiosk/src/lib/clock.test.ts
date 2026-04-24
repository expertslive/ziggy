import { describe, it, expect } from 'vitest'
import { getSimulatedNow } from './clock'

describe('getSimulatedNow', () => {
  it('returns real Date when no override', () => {
    const d = getSimulatedNow(undefined)
    expect(d).toBeInstanceOf(Date)
    expect(Math.abs(d.getTime() - Date.now())).toBeLessThan(1000)
  })

  it('returns parsed override when valid', () => {
    const d = getSimulatedNow('2026-06-02T10:30:00Z')
    expect(d.toISOString()).toBe('2026-06-02T10:30:00.000Z')
  })

  it('returns real Date on invalid override', () => {
    const d = getSimulatedNow('not-a-date')
    expect(Math.abs(d.getTime() - Date.now())).toBeLessThan(1000)
  })

  it('returns real Date on empty string override', () => {
    const d = getSimulatedNow('')
    expect(Math.abs(d.getTime() - Date.now())).toBeLessThan(1000)
  })
})
