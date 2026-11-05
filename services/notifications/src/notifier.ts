// What customers were told, once per event id.

import type { Notification, OrderEvent } from '@shop/contracts'

const TEXT: Record<OrderEvent['type'], string> = {
  'order.placed': 'We have your order.',
  'order.paid': 'Your payment arrived.',
  'order.shipped': 'Your order is on its way.',
  'order.cancelled': 'Your order is cancelled.',
}

export class Notifier {
  private byEvent = new Map<string, Notification>()

  /** The notification of `event`; a repeated event id records nothing new. */
  handle(event: OrderEvent): Notification {
    const known = this.byEvent.get(event.id)
    if (known) return known
    const notification = { eventId: event.id, orderId: event.orderId, text: TEXT[event.type] }
    this.byEvent.set(event.id, notification)
    return notification
  }

  of(orderId: string): Notification[] {
    return [...this.byEvent.values()].filter((n) => n.orderId === orderId)
  }
}
