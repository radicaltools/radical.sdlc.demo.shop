// The orders of the shop and their lifecycle: placed → paid → shipped → returned, or
// placed → cancelled.

import type { DeliveryAddress, Line, Order, OrderStatus } from '@shop/contracts'

const MOVES: Record<OrderStatus, OrderStatus[]> = {
  placed: ['paid', 'cancelled'],
  paid: ['shipped'],
  shipped: ['returned'],
  returned: [],
  cancelled: [],
}

export class WrongMove extends Error {}

export class OrderBook {
  private orders = new Map<string, Order>()
  private next = 1

  place(lines: Line[], total: number, deliveryAddress: DeliveryAddress): Order {
    const order: Order = { id: `o-${this.next++}`, lines, total, status: 'placed', deliveryAddress }
    this.orders.set(order.id, order)
    return order
  }

  get(id: string): Order | undefined {
    return this.orders.get(id)
  }

  get size(): number {
    return this.orders.size
  }

  /** Throws WrongMove when the lifecycle does not allow it. */
  check(id: string, to: OrderStatus): Order {
    const order = this.orders.get(id)!
    if (!MOVES[order.status].includes(to)) throw new WrongMove(`A ${order.status} order cannot become ${to}`)
    return order
  }

  move(id: string, to: OrderStatus, details: Pick<Order, 'reservationId' | 'trackingNumber' | 'shippedAt'> = {}): Order {
    const order = this.check(id, to)
    const moved = { ...order, ...details, status: to }
    this.orders.set(id, moved)
    return moved
  }
}
