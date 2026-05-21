export type OptionType = 'call' | 'put'

export interface OptionInputs {
  type: OptionType
  /** Current stock price */
  S: number
  /** Strike price */
  K: number
  /** Time to expiry in years */
  T: number
  /** Risk-free rate as decimal (e.g. 0.02 for 2%) */
  r: number
  /** Volatility as decimal (e.g. 0.30 for 30%) */
  sigma: number
}

export interface Greeks {
  premium: number
  delta: number
  gamma: number
  /** Vega per 1.0 change in sigma */
  vega: number
  theta: number
  rho: number
}

export function erf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)

  const t = 1.0 / (1.0 + p * x)
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return sign * y
}

export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)))
}

export function normalPDF(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x)
}

export function calculateD1(S: number, K: number, T: number, r: number, sigma: number): number {
  return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
}

export function calculateD2(d1: number, sigma: number, T: number): number {
  return d1 - sigma * Math.sqrt(T)
}

/** Price a European option using Black-Scholes. Returns 0 for invalid inputs. */
export function calculateOptionPrice(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0

  const d1 = calculateD1(S, K, T, r, sigma)
  const d2 = calculateD2(d1, sigma, T)

  if (type === 'call') {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
  }
}

/** Full Greeks for a European option. Returns all-zero for invalid inputs. */
export function calculateGreeks(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): Greeks {
  const zero: Greeks = { premium: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return zero

  const d1 = calculateD1(S, K, T, r, sigma)
  const d2 = calculateD2(d1, sigma, T)
  const sqrtT = Math.sqrt(T)
  const discountFactor = Math.exp(-r * T)
  const nd1 = normalPDF(d1)

  const gamma = nd1 / (S * sigma * sqrtT)
  const vega = S * nd1 * sqrtT

  if (type === 'call') {
    const Nd1 = normalCDF(d1)
    const Nd2 = normalCDF(d2)
    return {
      premium: S * Nd1 - K * discountFactor * Nd2,
      delta: Nd1,
      gamma,
      vega,
      theta: -(S * nd1 * sigma) / (2 * sqrtT) - r * K * discountFactor * Nd2,
      rho: K * T * discountFactor * Nd2,
    }
  } else {
    const NnD1 = normalCDF(-d1)
    const NnD2 = normalCDF(-d2)
    return {
      premium: K * discountFactor * NnD2 - S * NnD1,
      delta: NnD1 - 1,
      gamma,
      vega,
      theta: -(S * nd1 * sigma) / (2 * sqrtT) + r * K * discountFactor * NnD2,
      rho: -K * T * discountFactor * NnD2,
    }
  }
}

/**
 * Solve implied volatility via Newton-Raphson.
 * Returns volatility as a decimal (e.g. 0.30 for 30%), or 0 if unsolvable.
 */
export function impliedVolatility(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  marketPrice: number,
): number {
  if (T <= 0 || S <= 0 || K <= 0 || marketPrice <= 0) return 0

  // Initial guess using Brenner-Subrahmanyam approximation
  let sigma = Math.sqrt((2 * Math.PI) / T) * (marketPrice / S) * Math.exp(r * T)
  sigma = Math.max(0.01, Math.min(sigma, 3))

  const maxIterations = 100
  const tolerance = 1e-8

  for (let i = 0; i < maxIterations; i++) {
    const g = calculateGreeks(type, S, K, T, r, sigma)
    const diff = g.premium - marketPrice

    if (Math.abs(diff) < tolerance) return sigma

    if (Math.abs(g.vega) < tolerance) break

    // Newton-Raphson step with 0.5 damping for stability
    const newSigma = sigma - diff / g.vega
    sigma = sigma + 0.5 * (newSigma - sigma)
    sigma = Math.max(0.001, Math.min(sigma, 5))
  }

  return sigma
}
