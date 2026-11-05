// Places an order whose cart line has a negative unit price, and reads the total it is placed at.
// Exits 3 when an order is placed at a negative total, 0 when it is not.
const APP = 'http://localhost:4502'

const response = await fetch(`${APP}/orders`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lines: [{ sku: 'mug', unitPrice: -10, quantity: 1 }] }),
})
const text = await response.text()
console.log(`POST /orders answered ${response.status}: ${text}`)

let order
try {
  order = JSON.parse(text)
} catch {
  order = undefined
}
const bad = response.status === 201 && typeof order?.total === 'number' && order.total < 0
console.log(bad ? `Order ${order.id} placed at a negative total: ${order.total}` : 'No order was placed at a negative total')
process.exit(bad ? 3 : 0)
