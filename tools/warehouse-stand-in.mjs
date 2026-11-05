#!/usr/bin/env node
// Stands in for the Warehouse on a laptop and in an exploratory round: always has the goods,
// and answers as its OpenAPI descriptions say. The deploy runs the real one.
import { createServer } from 'node:http'

const reservations = new Map()
createServer((request, response) => {
  const answer = (code, body) => {
    response.writeHead(code, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }
  const key = request.headers['idempotency-key']
  if (request.method === 'GET' && request.url === '/health') return answer(200, { ok: true })
  if (request.method !== 'POST') return answer(404, { error: 'No such route' })
  request.resume()
  request.on('end', () => {
    if (request.url === '/reservations') {
      if (!reservations.has(key)) reservations.set(key, `r-${reservations.size + 1}`)
      return answer(201, { id: reservations.get(key) })
    }
    if (request.url === '/dispatches') return answer(201, { trackingNumber: `T-${key}` })
    return answer(404, { error: 'No such route' })
  })
}).listen(Number(process.env.PORT ?? 3011), '0.0.0.0')
