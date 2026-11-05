// F3: two order events that arrive without an id: the second is answered as the first,
// so its order is never told. Notifications port 4703. Exit 3 when the problem is there, 0 when not.
const URL_EVENTS = 'http://localhost:4703/events'
const stamp = Date.now()
const first = { type: 'order.paid', orderId: `o-f3a-${stamp}` }
const second = { type: 'order.shipped', orderId: `o-f3b-${stamp}` }

const post = async (event) => {
  const response = await fetch(URL_EVENTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  })
  return { status: response.status, body: await response.json() }
}

const a = await post(first)
console.log('first (no id) ->', a.status, JSON.stringify(a.body))
const b = await post(second)
console.log('second (no id) ->', b.status, JSON.stringify(b.body))

const listed = await (await fetch(`http://localhost:4703/notifications?orderId=${second.orderId}`)).json()
console.log(`GET /notifications?orderId=${second.orderId} ->`, JSON.stringify(listed))

const told = Array.isArray(listed) && listed.length > 0
if (!told || b.body.orderId !== second.orderId) {
  console.log('PROBLEM: the event of', second.orderId, 'is answered as another order\'s notification and not recorded for it')
  process.exit(3)
}
console.log('OK: the second order is told about its own event')
process.exit(0)
