// F2: an event of a type that is not an order event is recorded as a notification with no text.
// Also a type named after an Object key (constructor, toString) gets no text.
// Notifications port 4703. Exit 3 when the problem is there, 0 when not.
const URL_EVENTS = 'http://localhost:4703/events'
const stamp = Date.now()
const cases = [
  { id: `f2-refund-${stamp}`, type: 'order.refunded', orderId: `o-f2-${stamp}` },
  { id: `f2-ctor-${stamp}`, type: 'constructor', orderId: `o-f2c-${stamp}` },
]

let problem = false
for (const event of cases) {
  const response = await fetch(URL_EVENTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  })
  const body = await response.text()
  console.log('POST /events', JSON.stringify(event), '->', response.status, body)
  if (response.status < 400 && !body.includes('"text":"')) {
    console.log('PROBLEM: an event of unknown type', event.type, 'is accepted and recorded with no text')
    problem = true
  }
}

process.exit(problem ? 3 : 0)
