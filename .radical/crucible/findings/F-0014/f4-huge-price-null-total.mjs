// F4: a cart whose price overflows (a huge unit price) is answered 200 with a total of null,
// not a number and not a refusal. Prices must be numbers with at most two decimals.
const PORT = 4601
const url = `http://localhost:${PORT}/quote`

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ lines: [{ sku: 'mug', unitPrice: 1e308, quantity: 2 }] }),
})
const text = await res.text()
console.log(`status ${res.status} body ${text}`)

let quote = null
try { quote = JSON.parse(text) } catch { quote = null }
if (res.status === 200 && quote && (quote.total === null || quote.subtotal === null)) {
  console.log(`PROBLEM: two mugs at 1e308 are priced at a total of ${quote.total} (subtotal ${quote.subtotal})`)
  process.exit(3)
}
console.log('OK: the overflowing cart is refused or priced as a number')
process.exit(0)
