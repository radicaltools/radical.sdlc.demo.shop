#!/usr/bin/env node
// One service of the shop on the ports of an exploratory run, for radical explore:
//   node tools/serve-for-explore.mjs <service> <orders port> <pricing port> <notifications port>
// The orders service brings its own stand-in for the Warehouse, on the port after the last.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const [service, orders, pricing, notifications] = process.argv.slice(2)
const ports = { orders, pricing, notifications }
const warehouse = String(Number(notifications) + 1)
const child = spawn('npx', ['tsx', 'src/main.ts'], {
  cwd: fileURLToPath(new URL(`../services/${service}`, import.meta.url)),
  stdio: 'inherit',
  detached: true,
  env: { ...process.env, PORT: ports[service], PRICING_URL: `http://localhost:${pricing}`, NOTIFICATIONS_URL: `http://localhost:${notifications}`, STOCK_URL: `http://localhost:${warehouse}`, DISPATCH_URL: `http://localhost:${warehouse}` },
})
const standIn = service === 'orders'
  ? spawn('node', [fileURLToPath(new URL('warehouse-stand-in.mjs', import.meta.url))], { stdio: 'inherit', detached: true, env: { ...process.env, PORT: warehouse } })
  : undefined
const stop = () => {
  for (const c of [child, standIn]) { try { if (c) process.kill(-c.pid) } catch {} }
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
child.on('exit', (code) => process.exit(code ?? 1))
