// The notifications service: POST /events, GET /notifications?orderId=.

import Fastify, { type FastifyInstance } from 'fastify'
import type { OrderEvent } from '@shop/contracts'
import { Notifier } from './notifier.js'

export function buildServer(notifier = new Notifier()): FastifyInstance {
  const app = Fastify()
  app.get('/health', async () => ({ ok: true }))
  app.post<{ Body: OrderEvent }>('/events', async (request) => notifier.handle(request.body))
  app.get<{ Querystring: { orderId: string } }>('/notifications', async (request) => notifier.of(request.query.orderId))
  return app
}
