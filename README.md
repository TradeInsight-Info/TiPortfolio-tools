# @tradeinsight/options

Black-Scholes pricing, Greeks, implied volatility, and options strategy payoff utilities — extracted from [tradeinsight.info](https://tradeinsight.info) tools.

## Install

```bash
npm install @tradeinsight/options
# or
pnpm add @tradeinsight/options
```

## Usage

```ts
import { calculateOptionPrice, impliedVolatility, strategyPayoffCurve } from '@tradeinsight/options'

// Price a call option
const callPrice = calculateOptionPrice('call', 100, 100, 1, 0.02, 0.3)
// → ~12.82

// Solve implied volatility from a market price
const iv = impliedVolatility('call', 100, 100, 1, 0.02, 12.82)
// → ~0.30 (30%)

// Build a payoff curve for a bull spread
const legs = [
  { type: 'call', side: 'long',  strike: 100, quantity: 1, premium: 5, daysToExpiry: 365 },
  { type: 'call', side: 'short', strike: 110, quantity: 1, premium: 2, daysToExpiry: 365 },
]
const curve = strategyPayoffCurve(legs, [90, 95, 100, 105, 110, 115, 120], new Date(), 0.02, 0.3)
```

## API

### Black-Scholes

- `calculateOptionPrice(type, S, K, T, r, sigma)` — option price
- `calculateGreeks(type, S, K, T, r, sigma)` — `{ premium, delta, gamma, vega, theta, rho }`
- `impliedVolatility(type, S, K, T, r, marketPrice)` — IV via Newton-Raphson (returns decimal, e.g. `0.30`)

### Strategy Payoff

- `legPayoffAtExpiry(leg, spot)` — single-leg payoff at expiry
- `legPayoffAtDate(leg, spot, currentDate, r, sigma)` — single-leg P&L with time value
- `strategyPayoffCurve(legs, spotRange, currentDate, r, sigma)` — `{ spot, todayPL, expiryPL }[]`
- `breakEvens(legs)` — sorted spot prices where expiry P&L crosses zero

## License

MIT
