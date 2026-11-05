// Unknown order not found: every route that names an order, not only GET.
import { buildServer } from '../../../../services/orders/src/server.js'
import { OrderBook } from '../../../../services/orders/src/orderBook.js'

const book = new OrderBook()
const quote = { subtotal: 20, discount: 0, vat: 4.6, beforeShipping: 24.6, shipping: 9.99, total: 34.59 }
const app = buildServer({ price: async () => quote, notify: async () => {} }, book)
const calls: [string, string][] = [
  ['GET', '/orders/o-999'],
  ['POST', '/orders/o-999/pay'],
  ['POST', '/orders/o-999/ship'],
  ['POST', '/orders/o-999/cancel'],
]
for (const [method, url] of calls) {
  const res = await app.inject({ method: method as 'GET' | 'POST', url })
  console.log(JSON.stringify({ method, url, status: res.statusCode, body: res.body }))
}
console.log(JSON.stringify({ ordersAfter: book.size }))
await app.close()
