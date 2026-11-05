#!/usr/bin/env node
// Starts the shop on this machine, on the ports docker compose uses, with a stand-in for
// the Warehouse, until Ctrl+C.
import { spawn } from 'node:child_process'

const children = [
  ...['pricing', 'orders', 'notifications'].map((service) => spawn('npx', ['tsx', 'src/main.ts'], {
    cwd: `services/${service}`, stdio: 'inherit', detached: true,
    env: { ...process.env, DISPATCH_URL: 'http://localhost:3011' },
  })),
  spawn('node', ['tools/warehouse-stand-in.mjs'], { stdio: 'inherit', detached: true }),
]
const stop = () => { for (const c of children) { try { process.kill(-c.pid) } catch {} } process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
