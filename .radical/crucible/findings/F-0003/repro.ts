// Quantity below one refused: a line whose quantity is missing or not a number.
import { buildServer } from '../../../../services/pricing/src/server.js'

const app = buildServer()
const cases: unknown[] = [
  [{ sku: 'mug', unitPrice: 20 }],
  [{ sku: 'mug', unitPrice: 20, quantity: '0' }],
  [{ sku: 'mug', unitPrice: 20, quantity: null }],
]
for (const lines of cases) {
  const res = await app.inject({ method: 'POST', url: '/quote', payload: { lines } })
  console.log(JSON.stringify({ lines, status: res.statusCode, body: res.body }))
}
await app.close()
