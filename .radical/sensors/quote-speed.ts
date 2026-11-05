// Sensor quote-speed, for the fitness function Quote speed (ADR Quotes stay
// fast): the median time of one quote of a 100-line cart, written as
// radical-metrics/1 to the metricsOut file radical sense run names.
import { writeFileSync } from 'node:fs'
import { quote } from '../../services/pricing/src/quote.js'

const argument = process.argv.indexOf('--context')
if (argument < 0) throw new Error('no --context: run this sensor with radical sense run')
const context = JSON.parse(process.argv[argument + 1]) as { metricsOut: string }
const cart = Array.from({ length: 100 }, (_, i) => ({ sku: `sku-${i}`, unitPrice: 1 + (i % 17) * 2.35, quantity: 1 + (i % 4) }))

let sink = 0 // keeps the quotes from being optimised away
for (let i = 0; i < 2000; i++) sink += quote(cart, 'WELCOME10').total // warm-up
const samples: number[] = []
for (let round = 0; round < 31; round++) {
  const start = process.hrtime.bigint()
  for (let i = 0; i < 1000; i++) { cart[i % 100].quantity = 1 + (i % 4); sink += quote(cart, 'WELCOME10').total }
  samples.push(Number(process.hrtime.bigint() - start) / 1e3 / 1000)
}
samples.sort((a, b) => a - b)
const median = Math.round(samples[15] * 100) / 100

writeFileSync(context.metricsOut, JSON.stringify({
  format: 'radical-metrics', version: 1, source: 'quote-speed', at: new Date().toISOString(),
  measurements: [{ metric: 'pricing.quote_us', value: median, unit: 'us', labels: { cart: '100-lines' } }],
}, null, 2))
if (!Number.isFinite(sink)) throw new Error('no quote')
console.log(`A quote of a 100-line cart takes ${median} µs (median of 31 rounds of 1000).`)
