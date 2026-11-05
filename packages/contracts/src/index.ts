// What the services say to each other over HTTP (ADR Services talk over HTTP).
// Types only: no service gets behaviour from here.

export interface Line { sku: string; unitPrice: number; quantity: number }

/** POST /quote on the pricing service. */
export interface QuoteRequest { lines: Line[]; code?: string }
/** `beforeShipping` is the price before the shipping fee; `total` adds `shipping`. */
export interface Quote { subtotal: number; discount: number; vat: number; beforeShipping: number; shipping: number; total: number }

export type OrderStatus = 'placed' | 'paid' | 'shipped' | 'cancelled' | 'returned'
/** `reservationId` once paid, `trackingNumber` once shipped: both from the Warehouse. `shippedAt` (ISO time) once shipped. */
export interface Order { id: string; lines: Line[]; total: number; status: OrderStatus; reservationId?: string; trackingNumber?: string; shippedAt?: string }

/** POST /orders on the orders service. */
export interface PlaceOrderRequest { lines: Line[]; code?: string }

export type OrderEventType = 'order.placed' | 'order.paid' | 'order.shipped' | 'order.cancelled'
/** POST /events on the notifications service. `id` is unique per event. */
export interface OrderEvent { id: string; type: OrderEventType; orderId: string }

/** The carrier's status of a delivery, as the Warehouse answers it on GET /dispatches/{reservationId}. */
export type CarrierStatus = 'in-transit' | 'delivered' | 'lost'
/** GET /orders/{id}/tracking on the orders service: the tracking number the order was given, and the carrier's status of its delivery. */
export interface Tracking { trackingNumber: string; status: CarrierStatus }

export interface Notification { eventId: string; orderId: string; text: string }

export interface ErrorBody { error: string }

/** The answer 409 of paying an order whose goods are short in the Warehouse. */
export interface ShortAnswer extends ErrorBody { short: { sku: string; requested: number; available: number }[] }
