// F2: two payments of one placed order sent at once: the second is answered 409
// "A paid order cannot become paid", not the order as paid. Exit 3 when so; 0 when both answer 200.
const ORDERS = 'http://localhost:4502'

const post = async (url, body) => {
  const response = await fetch(url, body === undefined ? { method: 'POST' } : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.text() }
}

const placed = await post(`${ORDERS}/orders`, { lines: [{ sku: 'MUG', unitPrice: 10, quantity: 2 }] })
const id = JSON.parse(placed.body).id
const [first, second] = await Promise.all([
  post(`${ORDERS}/orders/${id}/pay`),
  post(`${ORDERS}/orders/${id}/pay`),
])
console.log(`order ${id}`)
console.log(`pay #1: ${first.status} ${first.body.slice(0, 160)}`)
console.log(`pay #2: ${second.status} ${second.body.slice(0, 160)}`)
process.exit(first.status === 200 && second.status === 200 ? 0 : 3)
