#!/usr/bin/env node
// Sensor smoke, for the fitness function Order crosses the systems (ADRs Payment waits for
// stock, Services talk over HTTP): places, pays and ships an order through the running
// stacks of both systems, and reads its notifications and the stock. The URLs say where they
// are (default: the ports of npm run stack and docker compose).
const orders = process.env.ORDERS_URL ?? 'http://localhost:3002'
const notifications = process.env.NOTIFICATIONS_URL ?? 'http://localhost:3003'
const stock = process.env.STOCK_URL ?? 'http://localhost:3011'

function fail(message) {
  console.error(message)
  process.exit(1)
}

const post = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) fail(`POST ${url} answered ${response.status}: ${await response.text()}`)
  return response.json()
}

try {
  const sku = `smoke-${Date.now()}`
  await post(`${stock}/stock/receipts`, { sku, quantity: 5 })
  const order = await post(`${orders}/orders`, { lines: [{ sku, unitPrice: 20, quantity: 2 }] })
  const paid = await post(`${orders}/orders/${order.id}/pay`)
  const { held } = await (await fetch(`${stock}/stock/${sku}`)).json()
  if (held !== 2) fail(`A paid order of 2 holds ${held} in the Warehouse.`)
  const shipped = await post(`${orders}/orders/${order.id}/ship`)
  if (!paid.reservationId || !shipped.trackingNumber) fail(`No reservation or tracking number: ${JSON.stringify(shipped)}.`)
  const { onHand } = await (await fetch(`${stock}/stock/${sku}`)).json()
  if (onHand !== 3) fail(`After shipping 2 of 5 there are ${onHand} on hand.`)
  const notes = await (await fetch(`${notifications}/notifications?orderId=${order.id}`)).json()
  const expected = ['placed', 'paid', 'shipped'].map((s) => `${order.id}:order.${s}`)
  const missing = expected.filter((id) => !notes.some((n) => n.eventId === id))
  if (missing.length) fail(`Not notified: ${missing.join(', ')}.`)
  console.log(`Order ${order.id} crossed the systems: ${shipped.trackingNumber}, three notifications, stock taken.`)
} catch (error) {
  fail(`The stacks do not answer: ${error.message}`)
}
