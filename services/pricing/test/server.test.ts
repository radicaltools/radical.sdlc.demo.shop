import { describe, expect, it } from 'vitest'
import { buildServer } from '../src/server.js'

describe('pricing service', () => {
  it('prices a cart over HTTP', async () => {
    const lines = [{ sku: 'mug', unitPrice: 20, quantity: 2 }, { sku: 'beans', unitPrice: 35.5, quantity: 1 }]
    const response = await buildServer().inject({ method: 'POST', url: '/quote', payload: { lines } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ beforeShipping: 92.87, shipping: 9.99, total: 102.86 })
  })
  it('answers 400 to an unknown code', async () => {
    const response = await buildServer().inject({ method: 'POST', url: '/quote', payload: { lines: [], code: 'NOPE' } })
    expect(response.statusCode).toBe(400)
  })
})
