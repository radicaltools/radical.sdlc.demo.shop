// The real calls to the other services. The Warehouse is another system, in another
// repository: WAREHOUSE_CALLS says what the orders service asks of it, and the sensor
// warehouse-contract compares that with its OpenAPI descriptions at the pinned version
// (ADR APIs described in OpenAPI).

import type { CarrierStatus, ErrorBody, Line, OrderEvent, Quote, ShortAnswer, Tracking } from '@shop/contracts'
import { Refused, ShortGoods, WarehouseDown, type Neighbours } from './server.js'

export const WAREHOUSE_CALLS = {
  reserve: { service: 'stock', method: 'POST', path: '/reservations' },
  dispatch: { service: 'dispatch', method: 'POST', path: '/dispatches' },
  return: { service: 'stock', method: 'POST', path: '/reservations/{id}/return' },
  status: { service: 'dispatch', method: 'GET', path: '/dispatches/{reservationId}' },
} as const

export interface Urls { pricing: string; notifications: string; stock: string; dispatch: string }

export function neighboursAt(urls: Urls): Neighbours {
  /** A named write to the Warehouse; anything but an answer is WarehouseDown. */
  const write = async (url: string, key: string, body: object): Promise<Response> => {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new WarehouseDown((error as Error).message)
    }
  }
  return {
    async price(lines: Line[], code?: string): Promise<Quote> {
      const response = await fetch(`${urls.pricing}/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines, code }),
      })
      if (response.status === 400) throw new Refused(((await response.json()) as ErrorBody).error)
      if (!response.ok) throw new Error(`Pricing answered ${response.status}`)
      return (await response.json()) as Quote
    },
    async notify(event: OrderEvent): Promise<void> {
      await fetch(`${urls.notifications}/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      })
    },
    async reserve(orderId, lines) {
      const body = { lines: lines.map(({ sku, quantity }) => ({ sku, quantity })) }
      const response = await write(`${urls.stock}${WAREHOUSE_CALLS.reserve.path}`, orderId, body)
      if (response.status === 409) throw new ShortGoods(((await response.json()) as ShortAnswer).short)
      if (!response.ok) throw new WarehouseDown(`Stock answered ${response.status}`)
      return ((await response.json()) as { id: string }).id
    },
    async return(orderId, reservationId) {
      const path = WAREHOUSE_CALLS.return.path.replace('{id}', encodeURIComponent(reservationId))
      const response = await write(`${urls.stock}${path}`, orderId, {})
      if (!response.ok) throw new WarehouseDown(`Stock answered ${response.status}`)
    },
    async dispatch(orderId, reservationId) {
      const response = await write(`${urls.dispatch}${WAREHOUSE_CALLS.dispatch.path}`, orderId, { reservationId })
      if (!response.ok) throw new WarehouseDown(`Dispatch answered ${response.status}`)
      return ((await response.json()) as { trackingNumber: string }).trackingNumber
    },
    async carrierStatus(reservationId): Promise<Tracking> {
      const path = WAREHOUSE_CALLS.status.path.replace('{reservationId}', encodeURIComponent(reservationId))
      let response: Response
      try {
        response = await fetch(`${urls.dispatch}${path}`)
      } catch (error) {
        throw new WarehouseDown((error as Error).message)
      }
      if (!response.ok) throw new WarehouseDown(`Dispatch answered ${response.status}`)
      const { trackingNumber, status, estimatedDeliveryDate, deliveredAt } = (await response.json()) as {
        trackingNumber: string
        status: CarrierStatus
        estimatedDeliveryDate?: string | null
        deliveredAt?: string | null
      }
      return { trackingNumber, status, estimatedDeliveryDate: estimatedDeliveryDate ?? null, deliveredAt: deliveredAt ?? null }
    },
  }
}
