// Places an order whose lines are a string, a malformed request. Exits 3 when the answer is a 5xx
// (a bad request is the client's mistake and gets a 4xx), 0 when it is a 4xx.
const APP = 'http://localhost:4502'

const response = await fetch(`${APP}/orders`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lines: 'mug' }),
})
const text = await response.text()
console.log(`POST /orders with lines "mug" answered ${response.status}: ${text}`)

const bad = response.status >= 500
console.log(bad ? `A malformed order got ${response.status}, not a 4xx` : 'A malformed order got a 4xx')
process.exit(bad ? 3 : 0)
