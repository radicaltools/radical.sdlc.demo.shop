// The named writes of the orders service, for the sensor idempotency (ADR Retried
// writes change nothing): each is sent twice, and the second must change nothing.

import { OrderBook } from '../src/orderBook.js'
import { buildServer } from '../src/server.js'

export const probes = [{
  name: 'POST /orders/{id}/pay',
  async prepare() {
    let reserved = 0
    const book = new OrderBook()
    const { id } = book.place([{ sku: 'mug', unitPrice: 20, quantity: 1 }], 34.59)
    const app = buildServer({
      price: async () => { throw new Error('not asked') },
      notify: async () => {},
      reserve: async () => `r-${++reserved}`,
      dispatch: async () => 'T-1',
      return: async () => {},
      carrierStatus: async () => ({ trackingNumber: 'T-1', status: 'in-transit', estimatedDeliveryDate: null }),
    }, book)
    return {
      app,
      request: { method: 'POST' as const, url: `/orders/${id}/pay` },
      state: async () => ({ reserved, order: book.get(id) }),
    }
  },
}]
