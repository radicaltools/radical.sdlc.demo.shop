// Q1 (question for the maintainer): an event id used again for another order is answered as
// the first event, so the second order is never told. Is a reused id a repeat (the rule of
// "Repeated event notified once" says so) or a second event that should be recorded?
// Exits 3 when the second order is told nothing, 0 when it is told.
const BASE = 'http://localhost:4703'
const run = `${Date.now()}-${Math.random().toString(36).slice(2)}`
const id = `q1-${run}:order.paid`
const orderA = `q1-A-${run}`
const orderB = `q1-B-${run}`

const first = await fetch(`${BASE}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id, type: 'order.paid', orderId: orderA }),
})
const second = await fetch(`${BASE}/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id, type: 'order.paid', orderId: orderB }),
})
const secondBody = await second.json()
const listB = await (await fetch(`${BASE}/notifications?orderId=${orderB}`)).json()

console.log(`POST /events id ${id} for ${orderA}: ${first.status}`)
console.log(`POST /events same id for ${orderB}: ${second.status} ${JSON.stringify(secondBody)}`)
console.log(`notifications listed for ${orderB}: ${JSON.stringify(listB)}`)
const problem = listB.length === 0
console.log(problem ? `QUESTION: ${orderB} is told nothing about its paid event` : 'no problem')
process.exit(problem ? 3 : 0)
