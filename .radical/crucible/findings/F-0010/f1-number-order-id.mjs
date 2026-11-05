// F1: an order event whose orderId is a number is accepted and recorded, but the
// order's own list never shows it: GET /notifications?orderId= compares strings.
// Exits 3 when the problem is there, 0 when it is not.
const BASE = 'http://localhost:4703'
const orderId = 700000 + Math.floor(Math.random() * 100000)
const id = `f1-${Date.now()}-${Math.random().toString(36).slice(2)}:order.paid`

const post = await fetch(`${BASE}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id, type: 'order.paid', orderId }),
})
const posted = await post.text()
const list = await (await fetch(`${BASE}/notifications?orderId=${orderId}`)).json()
const listed = list.some((n) => n.eventId === id)

console.log(`POST /events with orderId ${orderId} (a number): ${post.status} ${posted}`)
console.log(`GET /notifications?orderId=${orderId}: ${JSON.stringify(list)}`)
console.log(`listed for its order: ${listed}`)
const problem = post.status < 300 && !listed
console.log(problem ? 'PROBLEM: accepted as a notification, never told to its order' : 'no problem')
process.exit(problem ? 3 : 0)
