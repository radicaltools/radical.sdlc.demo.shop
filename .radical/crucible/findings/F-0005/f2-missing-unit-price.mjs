// Places an order whose cart line has no unit price, and reads the total it is placed at.
// Exits 3 when an order is placed with a total that is not a number, 0 when it is not.
const APP = 'http://localhost:4502'

const response = await fetch(`${APP}/orders`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lines: [{ sku: 'mug', quantity: 1 }] }),
})
const text = await response.text()
console.log(`POST /orders answered ${response.status}: ${text}`)

let order
try {
  order = JSON.parse(text)
} catch {
  order = undefined
}
const bad = response.status === 201 && !(typeof order?.total === 'number' && Number.isFinite(order.total))
console.log(bad ? `Order ${order.id} placed with total ${JSON.stringify(order.total)}, not a number` : 'No order was placed with a total that is not a number')
process.exit(bad ? 3 : 0)
