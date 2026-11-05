// The named writes of the notifications service, for the sensor idempotency (ADR Retried
// writes change nothing): each is sent twice, and the second must change nothing.

import { buildServer } from '../src/server.js'

export const probes = [{
  name: 'POST /events',
  async prepare() {
    const app = buildServer()
    return {
      app,
      request: { method: 'POST' as const, url: '/events', payload: { id: 'o-1:order.paid', type: 'order.paid', orderId: 'o-1' } },
      state: async () => (await app.inject({ method: 'GET', url: '/notifications?orderId=o-1' })).json(),
    }
  },
}]
