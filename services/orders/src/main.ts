import { neighboursAt } from './neighbours.js'
import { buildServer } from './server.js'

const neighbours = neighboursAt({
  pricing: process.env.PRICING_URL ?? 'http://localhost:3001',
  notifications: process.env.NOTIFICATIONS_URL ?? 'http://localhost:3003',
  stock: process.env.STOCK_URL ?? 'http://localhost:3011',
  dispatch: process.env.DISPATCH_URL ?? 'http://localhost:3012',
})
await buildServer(neighbours).listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3002) })
