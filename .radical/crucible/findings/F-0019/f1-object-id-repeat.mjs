// Finding: an order event whose id is a JSON object is recorded again each time it is sent,
// so the customer is told twice about one event. A string id sent twice is the control.
// Usage: node f1-object-id-repeat.mjs   (ports written in below; exit 3 = problem present)

const NOTIFICATIONS = 'http://localhost:4703'

async function post(body) {
  const response = await fetch(`${NOTIFICATIONS}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.text() }
}

async function listed(orderId) {
  const response = await fetch(`${NOTIFICATIONS}/notifications?orderId=${encodeURIComponent(orderId)}`)
  return response.json()
}

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

// Control: a string id sent twice is recorded once.
const stringOrder = `run3-str-${stamp}`
const stringEvent = { id: `${stringOrder}:order.paid`, type: 'order.paid', orderId: stringOrder }
await post(stringEvent)
await post(stringEvent)
const stringSeen = await listed(stringOrder)

// The finding: the same event with an object id, sent twice.
const objectOrder = `run3-obj-${stamp}`
const objectEvent = { id: { order: objectOrder, type: 'order.paid' }, type: 'order.paid', orderId: objectOrder }
const first = await post(objectEvent)
const second = await post(objectEvent)
const objectSeen = await listed(objectOrder)

console.log(`control, string id sent twice: ${stringSeen.length} notification(s) for ${stringOrder}`)
console.log(`object id sent twice: answers ${first.status} then ${second.status}, ${objectSeen.length} notification(s) for ${objectOrder}`)
console.log(JSON.stringify(objectSeen))

if (objectSeen.length > 1) {
  console.log('PROBLEM: one event with an object id is notified twice')
  process.exit(3)
}
console.log('OK: one notification for the event')
process.exit(0)
