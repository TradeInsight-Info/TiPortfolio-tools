import { calculateOptionPrice } from './blackScholes'
import type { OptionType } from './blackScholes'

export interface OptionLeg {
  type: OptionType
  side: 'long' | 'short'
  strike: number
  quantity: number
  /** Premium paid/received per unit at entry */
  premium: number
  daysToExpiry: number
}

export interface PayoffPoint {
  spot: number
  todayPL: number
  expiryPL: number
}

const multiplier = (side: 'long' | 'short'): number => (side === 'long' ? 1 : -1)

/** Payoff of a single leg at expiry for a given spot price. */
export function legPayoffAtExpiry(leg: OptionLeg, spot: number): number {
  const m = multiplier(leg.side)
  if (leg.type === 'call') {
    return (Math.max(0, spot - leg.strike) - leg.premium) * leg.quantity * m
  } else {
    return (Math.max(0, leg.strike - spot) - leg.premium) * leg.quantity * m
  }
}

/**
 * Mark-to-market P&L of a single leg at a given date (with remaining time value).
 * Falls back to intrinsic value when time remaining is negligible.
 */
export function legPayoffAtDate(
  leg: OptionLeg,
  spot: number,
  currentDate: Date,
  r: number,
  sigma: number,
): number {
  const m = multiplier(leg.side)
  const T = Math.max(leg.daysToExpiry / 365, 0)

  if (T < 0.001) {
    return legPayoffAtExpiry(leg, spot)
  }

  const currentPrice = calculateOptionPrice(leg.type, spot, leg.strike, T, r, sigma)
  return (currentPrice - leg.premium) * leg.quantity * m
}

/**
 * Payoff curve across a range of spot prices.
 * Returns today P&L (with time value) and expiry P&L for each spot.
 */
export function strategyPayoffCurve(
  legs: OptionLeg[],
  spotRange: number[],
  currentDate: Date,
  r: number,
  sigma: number,
): PayoffPoint[] {
  return spotRange.map((spot) => {
    const todayPL = legs.reduce((sum, leg) => sum + legPayoffAtDate(leg, spot, currentDate, r, sigma), 0)
    const expiryPL = legs.reduce((sum, leg) => sum + legPayoffAtExpiry(leg, spot), 0)
    return { spot, todayPL, expiryPL }
  })
}

/**
 * Find spot prices where total expiry payoff crosses zero (break-even points).
 * Uses linear interpolation between sampled points.
 */
export function breakEvens(legs: OptionLeg[], resolution = 500): number[] {
  if (legs.length === 0) return []

  const strikes = legs.map((l) => l.strike)
  const minSpot = Math.max(Math.min(...strikes) * 0.5, 0.01)
  const maxSpot = Math.max(...strikes) * 1.5
  const step = (maxSpot - minSpot) / resolution

  const points: Array<{ spot: number; pnl: number }> = []
  for (let s = minSpot; s <= maxSpot; s += step) {
    points.push({ spot: s, pnl: legs.reduce((sum, leg) => sum + legPayoffAtExpiry(leg, s), 0) })
  }

  const result: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (a.pnl === 0) {
      result.push(a.spot)
    } else if (a.pnl * b.pnl < 0) {
      // Linear interpolation
      const t = -a.pnl / (b.pnl - a.pnl)
      result.push(a.spot + t * (b.spot - a.spot))
    }
  }

  return result.sort((a, b) => a - b)
}
