// The orders service: places orders and moves them through their lifecycle.
// It asks the pricing service for the price, the Warehouse to hold and send the
// goods (ADR Payment waits for stock), and tells the notifications service what
// happened, all over HTTP; the calls are handed in, so a test can stand in for
// the others.

import Fastify, { type FastifyInstance } from 'fastify'
import type { DeliveryAddress, Line, Order, OrderEvent, OrderEventType, PlaceOrderRequest, Quote, ShortAnswer, Tracking } from '@shop/contracts'
import { OrderBook, WrongMove } from './orderBook.js'

export interface Neighbours {
  price(lines: Line[], code?: string): Promise<Quote>
  notify(event: OrderEvent): Promise<void>
  /** Holds the order's lines, with the order's id as the idempotency key, and
   *  answers with the reservation's id. Throws ShortGoods or WarehouseDown. */
  reserve(orderId: string, lines: Line[]): Promise<string>
  /** Has the reservation dispatched to the address and answers with the tracking number.
   *  Throws WarehouseDown, also when the carrier is down. */
  dispatch(orderId: string, reservationId: string, deliveryAddress: DeliveryAddress): Promise<string>
  /** Puts the goods of the reservation back on the shelves, with the order's id as the
   *  idempotency key. Throws WarehouseDown. */
  return(orderId: string, reservationId: string): Promise<void>
  /** Reads the tracking number, the carrier's status, the estimated delivery date and the delivery time of a
   *  dispatched reservation; changes nothing. Throws WarehouseDown when the Warehouse does not answer that, a 404 included. */
  carrierStatus(reservationId: string): Promise<Tracking>
}

/** The pricing service answered that the cart cannot be priced. */
export class Refused extends Error {}
/** The Warehouse answered that a line of the order is short. */
export class ShortGoods extends Error {
  constructor(readonly short: ShortAnswer['short']) {
    super(`Short of ${short.map((l) => l.sku).join(', ')}`)
  }
}
/** The Warehouse, or the carrier behind it, cannot do it now. */
export class WarehouseDown extends Error {}

/** A shipped order is taken back up to this long after it shipped, the day 14 included. */
export const RETURN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/** The address of an order, as the four fields the carrier needs, the country in uppercase; or what is wrong with it. */
export function addressOf(value: unknown): { address: DeliveryAddress } | { error: string } {
  const missing = 'An order needs a delivery address: street, city, postal code and a two-letter country code'
  if (typeof value !== 'object' || value === null) return { error: missing }
  const { street, city, postalCode, country } = value as Record<string, unknown>
  const text = (field: unknown) => typeof field === 'string' && field.trim() !== ''
  if (!text(street) || !text(city) || !text(postalCode) || typeof country !== 'string') return { error: missing }
  if (!/^[A-Za-z]{2}$/.test(country)) return { error: `The country ${JSON.stringify(country)} is not a two-letter code, such as PL` }
  return { address: { street: street as string, city: city as string, postalCode: postalCode as string, country: country.toUpperCase() } }
}

export function buildServer(neighbours: Neighbours, book = new OrderBook(), now: () => Date = () => new Date()): FastifyInstance {
  const app = Fastify()

  /** A notification that cannot be sent does not undo the order. */
  const report = async (orderId: string, type: OrderEventType) => {
    await neighbours.notify({ id: `${orderId}:${type}`, type, orderId }).catch((error) => app.log.warn(error))
  }

  app.get('/health', async () => ({ ok: true }))

  /** The tracking of a shipped order, with the carrier's status from the Warehouse. */
  app.get<{ Params: { id: string } }>('/orders/:id/tracking', async (request, reply) => {
    const order = book.get(request.params.id)
    if (!order) return reply.code(404).send({ error: `No order ${request.params.id}` })
    // An order returned after shipping has shipped: its delivery is still the carrier's.
    if (order.status !== 'shipped' && order.status !== 'returned') {
      return reply.code(409).send({ error: `A ${order.status} order has not shipped` })
    }
    try {
      const { status, estimatedDeliveryDate, deliveredAt } = await neighbours.carrierStatus(order.reservationId!)
      // A time of delivery only means something once the parcel is delivered.
      const tracking: Tracking = {
        trackingNumber: order.trackingNumber!,
        status,
        estimatedDeliveryDate,
        deliveredAt: status === 'delivered' ? deliveredAt : null,
      }
      return tracking
    } catch (error) {
      if (error instanceof WarehouseDown) return reply.code(503).send({ error: 'The carrier status is not available' })
      throw error
    }
  })

  app.post<{ Body: PlaceOrderRequest }>('/orders', async (request, reply) => {
    const { lines, code } = request.body
    if (!lines?.length) return reply.code(400).send({ error: 'An order needs at least one line' })
    const checked = addressOf(request.body.deliveryAddress)
    if ('error' in checked) return reply.code(400).send({ error: checked.error })
    const { address: deliveryAddress } = checked
    let quote: Quote
    try {
      quote = await neighbours.price(lines, code)
    } catch (error) {
      if (error instanceof Refused) return reply.code(400).send({ error: error.message })
      return reply.code(503).send({ error: 'Pricing is not available' })
    }
    const order = book.place(lines, quote.total, deliveryAddress)
    await report(order.id, 'order.placed')
    return reply.code(201).send(order)
  })

  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    const order = book.get(request.params.id)
    return order ?? reply.code(404).send({ error: `No order ${request.params.id}` })
  })

  /** The payments in progress, by order: a second payment of the same order waits for
   *  the first instead of reserving again. */
  const paying = new Map<string, Promise<Order>>()
  const pay = async (id: string): Promise<Order> => {
    const order = book.check(id, 'paid')
    const reservationId = await neighbours.reserve(id, order.lines)
    const paid = book.move(id, 'paid', { reservationId })
    await report(id, 'order.paid')
    return paid
  }

  app.post<{ Params: { id: string } }>('/orders/:id/pay', async (request, reply) => {
    const { id } = request.params
    if (book.get(id)?.status === 'paid') return book.get(id) as Order
    try {
      let payment = paying.get(id)
      if (!payment) {
        payment = pay(id)
        paying.set(id, payment)
        const done = () => paying.delete(id)
        payment.then(done, done)
      }
      return await payment
    } catch (error) {
      if (error instanceof WrongMove) return reply.code(409).send({ error: error.message })
      if (error instanceof ShortGoods) return reply.code(409).send({ error: error.message, short: error.short })
      if (error instanceof WarehouseDown) return reply.code(503).send({ error: 'The warehouse is not available' })
      throw error
    }
  })

  app.post<{ Params: { id: string } }>('/orders/:id/ship', async (request, reply) => {
    const { id } = request.params
    try {
      const order = book.check(id, 'shipped')
      const trackingNumber = await neighbours.dispatch(id, order.reservationId!, order.deliveryAddress)
      const shipped = book.move(id, 'shipped', { trackingNumber, shippedAt: now().toISOString() })
      await report(id, 'order.shipped')
      return shipped
    } catch (error) {
      if (error instanceof WrongMove) return reply.code(409).send({ error: error.message })
      if (error instanceof WarehouseDown) return reply.code(503).send({ error: 'The warehouse is not available' })
      throw error
    }
  })

  app.post<{ Params: { id: string } }>('/orders/:id/return', async (request, reply) => {
    const { id } = request.params
    try {
      const order = book.check(id, 'returned')
      if (now().getTime() - Date.parse(order.shippedAt!) > RETURN_WINDOW_MS) {
        throw new WrongMove('A shipped order is returned within 14 days of shipping')
      }
      await neighbours.return(id, order.reservationId!)
      return book.move(id, 'returned')
    } catch (error) {
      if (error instanceof WrongMove) return reply.code(409).send({ error: error.message })
      if (error instanceof WarehouseDown) return reply.code(503).send({ error: 'The warehouse is not available' })
      throw error
    }
  })

  app.post<{ Params: { id: string } }>('/orders/:id/cancel', async (request, reply) => {
    try {
      const order = book.move(request.params.id, 'cancelled')
      await report(order.id, 'order.cancelled')
      return order
    } catch (error) {
      if (error instanceof WrongMove) return reply.code(409).send({ error: error.message })
      throw error
    }
  })

  return app
}
