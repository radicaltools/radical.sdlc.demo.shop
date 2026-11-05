// F3: an event whose id is a number (the contract says a string) is recorded, and the
// same event sent again with the id as a string is recorded a second time: the keys 5 and
// "5" differ in the notifier's map. The order then holds two notifications for one event.
// Exits 3 when the problem is there, 0 when it is not.
const BASE = 'http://localhost:4703'
const orderId = `f3-${Date.now()}-${Math.random().toString(36).slice(2)}`
const numericId = 300000 + Math.floor(Math.random() * 100000)
const event = { type: 'order.paid', orderId }

const first = await fetch(`${BASE}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...event, id: numericId }),
})
const firstBody = await first.text()
const second = await fetch(`${BASE}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...event, id: String(numericId) }),
})
const secondBody = await second.text()
const list = await (await fetch(`${BASE}/notifications?orderId=${encodeURIComponent(orderId)}`)).json()

console.log(`POST /events id ${numericId} (a number): ${first.status} ${firstBody}`)
console.log(`POST /events id "${numericId}" (the same event as a string): ${second.status} ${secondBody}`)
console.log(`notifications listed for ${orderId}: ${list.length} ${JSON.stringify(list)}`)
const problem = first.status < 300 && list.length >= 2
console.log(problem ? 'PROBLEM: one event notified twice, the id sent as a number and as a string' : 'no problem')
process.exit(problem ? 3 : 0)
