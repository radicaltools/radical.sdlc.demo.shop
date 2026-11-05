// F5 (question): a quantity of 1.5 is priced as one and a half units. The pricing
// contract (openapi.yaml) says quantity is an integer with minimum 1.
const PORT = 4601
const url = `http://localhost:${PORT}/quote`

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lines: [{ sku: 'mug', unitPrice: 20, quantity: 1.5 }] }),
})
const text = await res.text()
console.log(`status ${res.status} body ${text}`)

if (res.status === 200) {
  console.log('PROBLEM: a fractional quantity (1.5) is priced; the contract says integer')
  process.exit(3)
}
console.log('OK: the fractional quantity is refused')
process.exit(0)
