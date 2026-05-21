import { describe, expect, it } from 'vitest'
import { breakEvens, legPayoffAtExpiry, strategyPayoffCurve } from './strategy'
import type { OptionLeg } from './strategy'

const longCall = (strike: number, premium: number): OptionLeg => ({
  type: 'call', side: 'long', strike, quantity: 1, premium, daysToExpiry: 365,
})
const shortCall = (strike: number, premium: number): OptionLeg => ({
  type: 'call', side: 'short', strike, quantity: 1, premium, daysToExpiry: 365,
})
const longPut = (strike: number, premium: number): OptionLeg => ({
  type: 'put', side: 'long', strike, quantity: 1, premium, daysToExpiry: 365,
})

describe('legPayoffAtExpiry', () => {
  it('long call at expiry: max(S-K,0) - premium', () => {
    const leg = longCall(100, 5)
    expect(legPayoffAtExpiry(leg, 110)).toBeCloseTo(10 - 5, 10) // 5
    expect(legPayoffAtExpiry(leg, 100)).toBeCloseTo(0 - 5, 10)  // -5
    expect(legPayoffAtExpiry(leg, 90)).toBeCloseTo(0 - 5, 10)   // -5
  })

  it('short call at expiry: -(max(S-K,0) - premium)', () => {
    const leg = shortCall(100, 5)
    expect(legPayoffAtExpiry(leg, 110)).toBeCloseTo(-(10 - 5), 10) // -5
    expect(legPayoffAtExpiry(leg, 90)).toBeCloseTo(5, 10)           // +5 (keep premium)
  })

  it('long put at expiry: max(K-S,0) - premium', () => {
    const leg = longPut(100, 5)
    expect(legPayoffAtExpiry(leg, 90)).toBeCloseTo(10 - 5, 10)  // 5
    expect(legPayoffAtExpiry(leg, 110)).toBeCloseTo(0 - 5, 10)  // -5
  })

  it('respects quantity multiplier', () => {
    const leg: OptionLeg = { type: 'call', side: 'long', strike: 100, quantity: 3, premium: 5, daysToExpiry: 365 }
    expect(legPayoffAtExpiry(leg, 110)).toBeCloseTo(3 * (10 - 5), 10)
  })
})

describe('strategyPayoffCurve', () => {
  it('returns one point per spot in spotRange', () => {
    const spots = [90, 95, 100, 105, 110]
    const curve = strategyPayoffCurve([longCall(100, 5)], spots, new Date(), 0.02, 0.3)
    expect(curve).toHaveLength(5)
    expect(curve.map((p) => p.spot)).toEqual(spots)
  })

  it('expiry P&L matches legPayoffAtExpiry for each spot', () => {
    const leg = longCall(100, 5)
    const spots = [80, 95, 100, 105, 120]
    const curve = strategyPayoffCurve([leg], spots, new Date(), 0.02, 0.3)
    curve.forEach(({ spot, expiryPL }) => {
      expect(expiryPL).toBeCloseTo(legPayoffAtExpiry(leg, spot), 10)
    })
  })

  it('bull spread max loss = net debit, max profit = spread width - net debit', () => {
    const legs = [longCall(100, 5), shortCall(110, 2)] // net debit = 3
    const curve = strategyPayoffCurve(legs, [80, 90, 95, 100, 105, 110, 115, 120], new Date(), 0.02, 0.3)
    const expiryPLs = curve.map((p) => p.expiryPL)
    expect(Math.min(...expiryPLs)).toBeCloseTo(-3, 1)  // max loss = net debit
    expect(Math.max(...expiryPLs)).toBeCloseTo(7, 1)   // max profit = 10 - 3
  })
})

describe('breakEvens', () => {
  it('long call has one break-even at K + premium', () => {
    const bes = breakEvens([longCall(100, 5)])
    expect(bes).toHaveLength(1)
    expect(bes[0]).toBeCloseTo(105, 0)
  })

  it('long put has one break-even at K - premium', () => {
    const bes = breakEvens([longPut(100, 5)])
    expect(bes).toHaveLength(1)
    expect(bes[0]).toBeCloseTo(95, 0)
  })

  it('long straddle has two break-evens at K ± total premium', () => {
    // Buy call + buy put at same strike: BEs at K±premium
    const legs = [longCall(100, 5), longPut(100, 5)]
    const bes = breakEvens(legs)
    expect(bes).toHaveLength(2)
    expect(bes[0]).toBeCloseTo(90, 0)
    expect(bes[1]).toBeCloseTo(110, 0)
  })

  it('returns empty for empty legs', () => {
    expect(breakEvens([])).toHaveLength(0)
  })
})
