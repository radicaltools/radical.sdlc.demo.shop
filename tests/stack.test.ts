// The three services on real ports, talking over HTTP, with a stand-in for the
// Warehouse (the deploy runs the real one).

import Fastify, { type FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildServer as notifications } from '../services/notifications/src/server.js'
import { neighboursAt } from '../services/orders/src/neighbours.js'
import { buildServer as orders } from '../services/orders/src/server.js'
import { buildServer as pricing } from '../services/pricing/src/server.js'

let apps: FastifyInstance[] = []
let ordersUrl = ''
let notificationsUrl = ''
const listen = (app: FastifyInstance) => app.listen({ host: '127.0.0.1', port: 0 })
const post = (url: string, body?: object) => fetch(url, {
  method: 'POST',
  ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
})

beforeAll(async () => {
  const p = pricing()
  const n = notifications()
  const pricingUrl = await listen(p)
  notificationsUrl = await listen(n)
  const warehouse = Fastify()
  warehouse.post('/reservations', async (_request, reply) => reply.code(201).send({ id: 'r-1' }))
  warehouse.post('/dispatches', async (_request, reply) => reply.code(201).send({ trackingNumber: 'T-1' }))
  const warehouseUrl = await listen(warehouse)
  const o = orders(neighboursAt({ pricing: pricingUrl, notifications: notificationsUrl, stock: warehouseUrl, dispatch: warehouseUrl }))
  ordersUrl = await listen(o)
  apps = [p, n, warehouse, o]
})
afterAll(() => Promise.all(apps.map((a) => a.close())))

describe('stack', () => {
  it('notifies a paid order', async () => {
    const deliveryAddress = { street: 'Dluga 1', city: 'Warsaw', postalCode: '00-001', country: 'PL' }
    const order = await (await post(`${ordersUrl}/orders`, { lines: [{ sku: 'mug', unitPrice: 20, quantity: 1 }], deliveryAddress })).json() as { id: string; total: number }
    expect(order.total).toBe(34.59)
    await post(`${ordersUrl}/orders/${order.id}/pay`)
    const notes = await (await fetch(`${notificationsUrl}/notifications?orderId=${order.id}`)).json() as { eventId: string }[]
    expect(notes.map((n) => n.eventId)).toContain(`${order.id}:order.paid`)
  })
})
