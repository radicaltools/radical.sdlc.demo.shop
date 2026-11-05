// The pricing service: POST /quote.

import Fastify, { type FastifyInstance } from 'fastify'
import type { QuoteRequest } from '@shop/contracts'
import { BadQuantity, UnknownCode, quote } from './quote.js'

export function buildServer(): FastifyInstance {
  const app = Fastify()
  app.get('/health', async () => ({ ok: true }))
  app.post<{ Body: QuoteRequest }>('/quote', async (request, reply) => {
    try {
      return quote(request.body.lines, request.body.code)
    } catch (error) {
      if (error instanceof UnknownCode || error instanceof BadQuantity) {
        return reply.code(400).send({ error: error.message })
      }
      throw error
    }
  })
  return app
}
