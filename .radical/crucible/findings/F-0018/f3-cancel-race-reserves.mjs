// F3: a payment and a cancellation of one placed order sent at once. When the cancellation lands
// while the payment waits for the Warehouse, the payment is refused (409, the order is cancelled),
// but the Warehouse still holds the goods for it. The Warehouse stand-in numbers its reservations
// r-1, r-2, …; a reservation made between two probes leaves a gap. The race depends on arrival
// order, so each attempt is a fresh order, and the script exits 3 when any attempt shows the problem.
const ORDERS = 'http://localhost:4502'
const WAREHOUSE = 'http://localhost:4703'
const ATTEMPTS = 10

const post = async (url, body) => {
  const response = await fetch(url, body === undefined ? { method: 'POST' } : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.text() }
}
const probe = async (key) => {
  const response = await fetch(`${WAREHOUSE}/reservations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ lines: [] }),
  })
  return Number((await response.json()).id.split('-')[1])
}

let shown = 0
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const before = await probe(`probe-f3-${Date.now()}-${attempt}-a`)
  const placed = await post(`${ORDERS}/orders`, { lines: [{ sku: 'MUG', unitPrice: 10, quantity: 2 }] })
  const id = JSON.parse(placed.body).id
  const [pay, cancel] = await Promise.all([
    post(`${ORDERS}/orders/${id}/pay`),
    post(`${ORDERS}/orders/${id}/cancel`),
  ])
  const after = await probe(`probe-f3-${Date.now()}-${attempt}-b`)
  const reservations = after - before - 1
  const bad = pay.status === 409 && cancel.status === 200 && reservations > 0
  if (bad) shown++
  console.log(`attempt ${attempt} order ${id}: pay ${pay.status}, cancel ${cancel.status}, reservations made between probes ${reservations}${bad ? '  <- refused payment, goods held' : ''}`)
}
console.log(`shown in ${shown} of ${ATTEMPTS} attempts`)
process.exit(shown > 0 ? 3 : 0)
