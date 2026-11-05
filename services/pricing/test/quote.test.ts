import { describe, expect, it } from 'vitest'
import { quote } from '../src/quote.js'

const mug = { sku: 'mug', unitPrice: 20, quantity: 1 }

describe('quote', () => {
  it('adds VAT to the subtotal', () => {
    const lines = [{ sku: 'mug', unitPrice: 20, quantity: 2 }, { sku: 'beans', unitPrice: 35.5, quantity: 1 }]
    expect(quote(lines)).toEqual({ subtotal: 75.5, discount: 0, vat: 17.37, beforeShipping: 92.87, shipping: 9.99, total: 102.86 })
  })
  it('takes a discount code off before VAT', () => {
    expect(quote([mug], 'WELCOME10')).toEqual({ subtotal: 20, discount: 2, vat: 4.14, beforeShipping: 22.14, shipping: 9.99, total: 32.13 })
  })
  it('charges shipping under 100', () => {
    const beans = [{ sku: 'beans', unitPrice: 81.29, quantity: 1 }]
    expect(quote(beans)).toEqual({ subtotal: 81.29, discount: 0, vat: 18.7, beforeShipping: 99.99, shipping: 9.99, total: 109.98 })
  })
  it('ships free from 100', () => {
    const beans = [{ sku: 'beans', unitPrice: 81.3, quantity: 1 }]
    expect(quote(beans)).toEqual({ subtotal: 81.3, discount: 0, vat: 18.7, beforeShipping: 100, shipping: 0, total: 100 })
  })
  it('takes 10% off a cart from 200 with VAT', () => {
    const cart = [{ sku: 'grinder', unitPrice: 180, quantity: 1 }, { sku: 'mug', unitPrice: 20, quantity: 2 }]
    expect(quote(cart)).toEqual({ subtotal: 220, discount: 22, vat: 45.54, beforeShipping: 243.54, shipping: 0, total: 243.54 })
  })
  it('takes 10% off a cart at exactly 200 with VAT', () => {
    expect(quote([{ sku: 'beans', unitPrice: 162.6, quantity: 1 }])).toEqual({ subtotal: 162.6, discount: 16.26, vat: 33.66, beforeShipping: 180, shipping: 0, total: 180 })
  })
  it('takes no discount off a cart just under 200 with VAT', () => {
    expect(quote([{ sku: 'beans', unitPrice: 162.59, quantity: 1 }])).toEqual({ subtotal: 162.59, discount: 0, vat: 37.4, beforeShipping: 199.99, shipping: 0, total: 199.99 })
  })
  it('lets a code past the 200 threshold, and gives the largest of the code, 5% and 10%', () => {
    expect(quote([{ sku: 'beans', unitPrice: 162.6, quantity: 1 }], 'LOYAL20')).toEqual({ subtotal: 162.6, discount: 32.52, vat: 29.92, beforeShipping: 160, shipping: 0, total: 160 })
  })
  it('gives a code when it is larger than 5% and 10%', () => {
    const cart = [{ sku: 'grinder', unitPrice: 180, quantity: 1 }, { sku: 'mug', unitPrice: 20, quantity: 2 }]
    const fifteenPercent = { FIFTEEN: { share: 0.15, cap: 50 } }
    expect(quote(cart, 'FIFTEEN', fifteenPercent)).toEqual({ subtotal: 220, discount: 33, vat: 43.01, beforeShipping: 230.01, shipping: 0, total: 230.01 })
  })
  it('gives 10% when it is larger than a code', () => {
    const cart = [{ sku: 'grinder', unitPrice: 180, quantity: 1 }, { sku: 'mug', unitPrice: 20, quantity: 2 }]
    const twoPercent = { TWO: { share: 0.02, cap: 50 } }
    expect(quote(cart, 'TWO', twoPercent)).toEqual({ subtotal: 220, discount: 22, vat: 45.54, beforeShipping: 243.54, shipping: 0, total: 243.54 })
  })
  it('caps a discount', () => {
    const cart = [{ sku: 'grinder', unitPrice: 400, quantity: 1 }]
    const twentyPercent = { TWENTY: { share: 0.2, cap: 50 } }
    expect(quote(cart, 'TWENTY', twentyPercent)).toEqual({ subtotal: 400, discount: 50, vat: 80.5, beforeShipping: 430.5, shipping: 0, total: 430.5 })
  })
  it('refuses an unknown code', () => {
    expect(() => quote([mug], 'NOPE')).toThrow('Unknown discount code NOPE')
  })
  it('refuses a quantity below one', () => {
    expect(() => quote([{ sku: 'mug', unitPrice: 20, quantity: 0 }])).toThrow()
    expect(() => quote([{ sku: 'mug', unitPrice: 20, quantity: -1 }])).toThrow()
  })
})
