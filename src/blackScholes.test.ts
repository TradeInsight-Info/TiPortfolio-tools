import { describe, expect, it } from 'vitest'
import {
  calculateD1,
  calculateD2,
  calculateGreeks,
  calculateOptionPrice,
  erf,
  impliedVolatility,
  normalCDF,
  normalPDF,
} from './blackScholes'

describe('erf / normalCDF / normalPDF', () => {
  it('erf(0) ≈ 0 (polynomial approx, error < 1.5e-7)', () => expect(Math.abs(erf(0))).toBeLessThan(1e-8))
  it('erf(1) ≈ 0.8427', () => expect(erf(1)).toBeCloseTo(0.8427007929, 5))
  it('erf is odd: erf(-x) = -erf(x)', () => {
    expect(erf(-1.5)).toBeCloseTo(-erf(1.5), 6)
  })
  it('normalCDF(0) ≈ 0.5 (polynomial approx)', () => expect(Math.abs(normalCDF(0) - 0.5)).toBeLessThan(1e-8))
  it('normalCDF(∞) → 1', () => expect(normalCDF(10)).toBeCloseTo(1, 5))
  it('normalPDF(0) = 1/√(2π)', () =>
    expect(normalPDF(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 10))
})

describe('calculateOptionPrice', () => {
  // Reference: S=100, K=100, T=1, r=0.02, σ=0.30
  it('call price ≈ 12.82', () =>
    expect(calculateOptionPrice('call', 100, 100, 1, 0.02, 0.3)).toBeCloseTo(12.82, 1))

  it('put price ≈ 10.84', () =>
    expect(calculateOptionPrice('put', 100, 100, 1, 0.02, 0.3)).toBeCloseTo(10.84, 1))

  it('satisfies put-call parity: C - P = S - K*e^(-rT)', () => {
    const S = 100, K = 100, T = 1, r = 0.02, sigma = 0.3
    const call = calculateOptionPrice('call', S, K, T, r, sigma)
    const put = calculateOptionPrice('put', S, K, T, r, sigma)
    expect(call - put).toBeCloseTo(S - K * Math.exp(-r * T), 6)
  })

  it('returns 0 for T=0', () =>
    expect(calculateOptionPrice('call', 100, 100, 0, 0.02, 0.3)).toBe(0))

  it('returns 0 for sigma=0', () =>
    expect(calculateOptionPrice('call', 100, 100, 1, 0.02, 0)).toBe(0))

  it('deep ITM call ≈ intrinsic value', () => {
    // S=200, K=100: deep ITM call ≈ S - K*e^(-rT)
    const price = calculateOptionPrice('call', 200, 100, 1, 0.02, 0.3)
    expect(price).toBeGreaterThan(90)
  })

  it('deep OTM call ≈ 0', () => {
    const price = calculateOptionPrice('call', 100, 300, 1, 0.02, 0.3)
    expect(price).toBeLessThan(0.01)
  })
})

describe('impliedVolatility', () => {
  it('round-trips call price → IV → price within 1e-4', () => {
    const S = 100, K = 100, T = 1, r = 0.02, sigma = 0.3
    const marketPrice = calculateOptionPrice('call', S, K, T, r, sigma)
    const iv = impliedVolatility('call', S, K, T, r, marketPrice)
    expect(Math.abs(iv - sigma)).toBeLessThan(1e-4)
  })

  it('round-trips put price → IV → price within 1e-4', () => {
    const S = 100, K = 105, T = 0.5, r = 0.03, sigma = 0.25
    const marketPrice = calculateOptionPrice('put', S, K, T, r, sigma)
    const iv = impliedVolatility('put', S, K, T, r, marketPrice)
    expect(Math.abs(iv - sigma)).toBeLessThan(1e-4)
  })

  it('returns 0 for T=0', () =>
    expect(impliedVolatility('call', 100, 100, 0, 0.02, 5)).toBe(0))

  it('returns 0 for marketPrice=0', () =>
    expect(impliedVolatility('call', 100, 100, 1, 0.02, 0)).toBe(0))
})

describe('calculateGreeks', () => {
  it('call delta is between 0 and 1', () => {
    const g = calculateGreeks('call', 100, 100, 1, 0.02, 0.3)
    expect(g.delta).toBeGreaterThan(0)
    expect(g.delta).toBeLessThan(1)
  })

  it('put delta is between -1 and 0', () => {
    const g = calculateGreeks('put', 100, 100, 1, 0.02, 0.3)
    expect(g.delta).toBeGreaterThan(-1)
    expect(g.delta).toBeLessThan(0)
  })

  it('call and put share same gamma', () => {
    const call = calculateGreeks('call', 100, 100, 1, 0.02, 0.3)
    const put = calculateGreeks('put', 100, 100, 1, 0.02, 0.3)
    expect(call.gamma).toBeCloseTo(put.gamma, 10)
  })

  it('premium matches calculateOptionPrice', () => {
    const g = calculateGreeks('call', 100, 100, 1, 0.02, 0.3)
    expect(g.premium).toBeCloseTo(calculateOptionPrice('call', 100, 100, 1, 0.02, 0.3), 10)
  })

  it('returns zero Greeks for invalid inputs', () => {
    const g = calculateGreeks('call', 0, 100, 1, 0.02, 0.3)
    expect(g.premium).toBe(0)
    expect(g.delta).toBe(0)
  })
})

describe('calculateD1 / calculateD2', () => {
  it('d2 = d1 - sigma*sqrt(T)', () => {
    const S = 100, K = 100, T = 1, r = 0.02, sigma = 0.3
    const d1 = calculateD1(S, K, T, r, sigma)
    const d2 = calculateD2(d1, sigma, T)
    expect(d2).toBeCloseTo(d1 - sigma * Math.sqrt(T), 10)
  })
})
