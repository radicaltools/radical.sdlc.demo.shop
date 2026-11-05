import Fastify from 'fastify'
import { afterAll, describe, expect, it } from 'vitest'
import type { OrderEvent } from '@shop/contracts'
import { neighboursAt } from '../src/neighbours.js'
import { OrderBook } from '../src/orderBook.js'
import { Refused, ShortGoods, WarehouseDown, buildServer, type Neighbours } from '../src/server.js'

const closing: { close(): Promise<unknown> }[] = []
afterAll(() => Promise.all(closing.map((app) => app.close())))

const lines = [{ sku: 'mug', unitPrice: 20, quantity: 1 }]
const quote = { subtotal: 20, discount: 0, vat: 4.6, beforeShipping: 24.6, shipping: 9.99, total: 34.59 }

function shop(overrides: Partial<Neighbours> = {}) {
  const events: OrderEvent[] = []
  const book = new OrderBook()
  const reservations: { key: string; lines: unknown }[] = []
  const returns: { key: string; reservationId: string }[] = []
  const clock = { now: new Date('2026-11-01T10:00:00Z') }
  const app = buildServer({
    price: async () => quote,
    notify: async (e) => { events.push(e) },
    reserve: async (key, reserved) => { reservations.push({ key, lines: reserved }); return `r-${reservations.length}` },
    dispatch: async () => 'T-1',
    return: async (key, reservationId) => { returns.push({ key, reservationId }) },
    carrierStatus: async () => ({ trackingNumber: 'T-1', status: 'in-transit', estimatedDeliveryDate: null, deliveredAt: null }),
    ...overrides,
  }, book, () => clock.now)
  const post = (url: string, payload?: object) => app.inject({ method: 'POST', url, payload })
  return { app, book, events, reservations, returns, clock, post, placed: async () => (await post('/orders', { lines })).json().id as string }
}

describe('orders', () => {
  it('places an order at the quoted total', async () => {
    const response = await shop().post('/orders', { lines })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ status: 'placed', total: 34.59 })
  })
  it('refuses an empty cart', async () => {
    expect((await shop().post('/orders', { lines: [] })).statusCode).toBe(400)
  })
  it('refuses a cart pricing refuses', async () => {
    const { post } = shop({ price: async () => { throw new Refused('Unknown discount code NOPE') } })
    expect((await post('/orders', { lines, code: 'NOPE' })).statusCode).toBe(400)
  })
  it('ships a paid order', async () => {
    const { post, placed } = shop()
    const id = await placed()
    await post(`/orders/${id}/pay`)
    expect((await post(`/orders/${id}/ship`)).json().status).toBe('shipped')
  })
  it('returns a shipped order on day 14', async () => {
    const grinders = [{ sku: 'grinder', unitPrice: 50, quantity: 2 }]
    const { post, returns, clock, book } = shop()
    const id = (await post('/orders', { lines: grinders })).json().id as string
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    clock.now = new Date('2026-11-15T10:00:00Z')
    const response = await post(`/orders/${id}/return`)
    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('returned')
    expect(returns).toEqual([{ key: id, reservationId: 'r-1' }])
    expect(book.get(id)?.status).toBe('returned')
  })
  it('refuses a return one second after day 14', async () => {
    const grinders = [{ sku: 'grinder', unitPrice: 50, quantity: 2 }]
    const { post, returns, clock, book } = shop()
    const id = (await post('/orders', { lines: grinders })).json().id as string
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    clock.now = new Date('2026-11-15T10:00:01Z')
    expect((await post(`/orders/${id}/return`)).statusCode).toBe(409)
    expect(book.get(id)?.status).toBe('shipped')
    expect(returns).toEqual([])
  })
  it('refuses the return of a placed order', async () => {
    const { post, returns, book, placed } = shop()
    const id = await placed()
    expect((await post(`/orders/${id}/return`)).statusCode).toBe(409)
    expect(book.get(id)?.status).toBe('placed')
    expect(returns).toEqual([])
  })
  it('keeps a shipped order shipped while the warehouse cannot take the goods back', async () => {
    const { post, book, placed } = shop({ return: async () => { throw new WarehouseDown('connection refused') } })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    expect((await post(`/orders/${id}/return`)).statusCode).toBe(503)
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('cancels a placed order', async () => {
    const { post, placed } = shop()
    expect((await post(`/orders/${await placed()}/cancel`)).json().status).toBe('cancelled')
  })
  it('keeps a paid order when cancelled', async () => {
    const { post, book, placed } = shop()
    const id = await placed()
    await post(`/orders/${id}/pay`)
    expect((await post(`/orders/${id}/cancel`)).statusCode).toBe(409)
    expect(book.get(id)?.status).toBe('paid')
  })
  it('refuses an order while pricing is down', async () => {
    const { post, book } = shop({ price: async () => { throw new Error('connection refused') } })
    expect((await post('/orders', { lines })).statusCode).toBe(503)
    expect(book.size).toBe(0)
  })
  it('answers 404 to an unknown order', async () => {
    const { app } = shop()
    expect((await app.inject({ method: 'GET', url: '/orders/o-999' })).statusCode).toBe(404)
  })
  it('keeps the order when a notification cannot be sent', async () => {
    const { post } = shop({ notify: async () => { throw new Error('connection refused') } })
    expect((await post('/orders', { lines })).statusCode).toBe(201)
  })
  it('reserves the goods when an order is paid', async () => {
    const { post, reservations, placed } = shop()
    const id = await placed()
    const response = await post(`/orders/${id}/pay`)
    expect(response.json()).toMatchObject({ status: 'paid', reservationId: 'r-1' })
    expect(reservations).toEqual([{ key: id, lines }])
  })
  it('keeps the order placed when the goods are short', async () => {
    const short = [{ sku: 'mug', requested: 3, available: 2 }]
    const { post, book, placed } = shop({ reserve: async () => { throw new ShortGoods(short) } })
    const id = await placed()
    const response = await post(`/orders/${id}/pay`)
    expect(response.statusCode).toBe(409)
    expect(response.json().short).toEqual(short)
    expect(book.get(id)?.status).toBe('placed')
  })
  it('keeps the order placed while the warehouse is down', async () => {
    const { post, book, placed } = shop({ reserve: async () => { throw new WarehouseDown('connection refused') } })
    const id = await placed()
    expect((await post(`/orders/${id}/pay`)).statusCode).toBe(503)
    expect(book.get(id)?.status).toBe('placed')
  })
  it('reserves once when an order is paid again', async () => {
    const { post, reservations, events, placed } = shop()
    const id = await placed()
    await post(`/orders/${id}/pay`)
    const again = await post(`/orders/${id}/pay`)
    expect(again.statusCode).toBe(200)
    expect(again.json().status).toBe('paid')
    expect(reservations).toHaveLength(1)
    expect(events.filter((e) => e.type === 'order.paid')).toHaveLength(1)
  })
  it('pays once when an order is paid twice at once', async () => {
    const reservations: string[] = []
    const { post, events, placed } = shop({
      reserve: async (key) => {
        reservations.push(key)
        await new Promise((done) => setTimeout(done, 20))
        return `r-${reservations.length}`
      },
    })
    const id = await placed()
    const [first, second] = await Promise.all([post(`/orders/${id}/pay`), post(`/orders/${id}/pay`)])
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({ status: 'paid', reservationId: 'r-1' })
    expect(reservations).toEqual([id])
    expect(events.filter((e) => e.type === 'order.paid')).toHaveLength(1)
  })
  it('keeps the tracking number of a shipped order', async () => {
    const { post, placed } = shop({ dispatch: async () => 'T-42' })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    expect((await post(`/orders/${id}/ship`)).json()).toMatchObject({ status: 'shipped', trackingNumber: 'T-42' })
  })
  it('keeps the order paid while the carrier is down', async () => {
    let carrierUp = false
    const { post, book, placed } = shop({ dispatch: async () => { if (!carrierUp) throw new WarehouseDown('carrier down'); return 'T-1' } })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    expect((await post(`/orders/${id}/ship`)).statusCode).toBe(503)
    expect(book.get(id)?.status).toBe('paid')
    carrierUp = true
    expect((await post(`/orders/${id}/ship`)).json().status).toBe('shipped')
  })
  it('answers the tracking of a shipped order', async () => {
    const carrierStatus = async () => ({ trackingNumber: 'TRK-7', status: 'in-transit' as const, estimatedDeliveryDate: '2026-11-20', deliveredAt: null })
    const { app, post, book, placed } = shop({ dispatch: async () => 'TRK-7', carrierStatus })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    const response = await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ trackingNumber: 'TRK-7', status: 'in-transit', estimatedDeliveryDate: '2026-11-20', deliveredAt: null })
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('answers the tracking of a shipped order without a date', async () => {
    const carrierStatus = async () => ({ trackingNumber: 'TRK-8', status: 'in-transit' as const, estimatedDeliveryDate: null, deliveredAt: null })
    const { app, post, book, placed } = shop({ dispatch: async () => 'TRK-8', carrierStatus })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    const response = await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ trackingNumber: 'TRK-8', status: 'in-transit', estimatedDeliveryDate: null, deliveredAt: null })
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('answers the tracking of a delivered order', async () => {
    const carrierStatus = async () => ({
      trackingNumber: 'TRK-9', status: 'delivered' as const, estimatedDeliveryDate: '2026-11-20', deliveredAt: '2026-11-21T10:30:00Z',
    })
    const { app, post, book, placed } = shop({ dispatch: async () => 'TRK-9', carrierStatus })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    const response = await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      trackingNumber: 'TRK-9', status: 'delivered', estimatedDeliveryDate: '2026-11-20', deliveredAt: '2026-11-21T10:30:00Z',
    })
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('answers the tracking of a delivered order without a time', async () => {
    const carrierStatus = async () => ({ trackingNumber: 'TRK-10', status: 'delivered' as const, estimatedDeliveryDate: '2026-11-20', deliveredAt: null })
    const { app, post, book, placed } = shop({ dispatch: async () => 'TRK-10', carrierStatus })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    const response = await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ trackingNumber: 'TRK-10', status: 'delivered', estimatedDeliveryDate: '2026-11-20', deliveredAt: null })
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('answers 503 to the tracking when the warehouse does not answer', async () => {
    const { app, post, book, placed } = shop({ carrierStatus: async () => { throw new WarehouseDown('connection refused') } })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    expect((await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })).statusCode).toBe(503)
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('answers 503 to the tracking when the warehouse answers 404 for the carrier status', async () => {
    const warehouse = Fastify()
    warehouse.get('/dispatches/:reservationId', async (_request, reply) => reply.code(404).send({ error: 'No such reservation' }))
    const url = await warehouse.listen({ host: '127.0.0.1', port: 0 })
    closing.push(warehouse)
    const carrierStatus = neighboursAt({ pricing: '', notifications: '', stock: '', dispatch: url }).carrierStatus
    const { app, post, book, placed } = shop({ carrierStatus })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    await post(`/orders/${id}/ship`)
    expect((await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })).statusCode).toBe(503)
    expect(book.get(id)?.status).toBe('shipped')
  })
  it('refuses the tracking of an order not shipped', async () => {
    const carrierStatus = async () => { throw new Error('the warehouse must not be asked') }
    const { app, post, book, placed } = shop({ carrierStatus })
    const id = await placed()
    await post(`/orders/${id}/pay`)
    expect((await app.inject({ method: 'GET', url: `/orders/${id}/tracking` })).statusCode).toBe(409)
    expect(book.get(id)?.status).toBe('paid')
  })
})
