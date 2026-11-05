// F1: POST /orders with no body, or with the JSON value null, is answered 500, not 4xx.
// Exit 3 when a 5xx answer is seen; 0 when every bad body gets a 4xx.
const ORDERS = 'http://localhost:4502'

const bodies = [
  { label: 'no body', init: {} },
  { label: 'JSON null', init: { headers: { 'content-type': 'application/json' }, body: 'null' } },
]

let problem = false
for (const { label, init } of bodies) {
  const response = await fetch(`${ORDERS}/orders`, { method: 'POST', ...init })
  const text = await response.text()
  console.log(`${label}: ${response.status} ${text.slice(0, 160)}`)
  if (response.status >= 500) problem = true
}
process.exit(problem ? 3 : 0)
