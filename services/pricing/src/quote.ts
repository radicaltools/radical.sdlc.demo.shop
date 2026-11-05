// What a cart costs. Knows nothing of orders.

import type { Line, Quote } from '@shop/contracts'

/** VAT on the discounted subtotal. */
export const VAT_RATE = 0.23

/** Discount codes: a share of the subtotal, capped. */
const CODES: Record<string, { share: number; cap: number }> = {
  WELCOME10: { share: 0.1, cap: 50 },
  LOYAL20: { share: 0.2, cap: 100 },
}

/** A cart whose price before shipping is below this pays the fee. */
export const FREE_SHIPPING_FROM = 100

/** A cart whose total with VAT, before any code, is at least this gets a share off. */
export const BIG_CART_FROM = 200

/** The big-cart share, off the subtotal. It does not stack with a code or the bulk share: the largest one applies. */
export const BIG_CART_SHARE = 0.05

/** The bulk share, off the subtotal, for the same carts as the big-cart share. It does not stack with a code or the big-cart share: the largest one applies. */
export const BULK_SHARE = 0.1

/** The shipping fee, without VAT. */
export const SHIPPING_FEE = 9.99

const cents = (n: number): number => Math.round(n * 100) / 100

export class UnknownCode extends Error {}

/** A cart line with a quantity below one. */
export class BadQuantity extends Error {}

/** The price of a cart, with an optional discount code. An unknown code is
 *  refused, and so is a line with a quantity below one. The discount is the largest
 *  of the code's share, the big-cart share and the bulk share, and it comes off
 *  before VAT. The shipping fee is added after VAT and rounding, and carries no VAT. */
export function quote(lines: Line[], code?: string, codes: Record<string, { share: number; cap: number }> = CODES): Quote {
  if (lines.some((l) => l.quantity < 1)) throw new BadQuantity('A cart line has a quantity below one')
  const subtotal = cents(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0))
  const listTotal = cents(subtotal + cents(subtotal * VAT_RATE))
  const qualifies = listTotal >= BIG_CART_FROM
  const bigCart = qualifies ? cents(subtotal * BIG_CART_SHARE) : 0
  const bulk = qualifies ? cents(subtotal * BULK_SHARE) : 0
  let codeDiscount = 0
  if (code !== undefined) {
    const rule = codes[code]
    if (!rule) throw new UnknownCode(`Unknown discount code ${code}`)
    codeDiscount = cents(Math.min(subtotal * rule.share, rule.cap))
  }
  const discount = Math.max(codeDiscount, bigCart, bulk)
  const vat = cents((subtotal - discount) * VAT_RATE)
  const beforeShipping = cents(subtotal - discount + vat)
  const shipping = beforeShipping < FREE_SHIPPING_FROM ? SHIPPING_FEE : 0
  return { subtotal, discount, vat, beforeShipping, shipping, total: cents(beforeShipping + shipping) }
}
