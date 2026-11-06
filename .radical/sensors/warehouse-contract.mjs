#!/usr/bin/env node
// Sensor warehouse-contract, for the fitness function Calls match the Warehouse API (ADR
// Shop follows the Warehouse API): every call in WAREHOUSE_CALLS of the orders service is
// described in the Warehouse's OpenAPI descriptions, as its main branch has them. The model
// orders the work, so what the Shop needs is there first. Runs with tsx.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { WAREHOUSE_CALLS } from '../../services/orders/src/neighbours.ts'

const { element } = JSON.parse(process.argv[process.argv.indexOf('--context') + 1])
if (!element?.paths?.includes('services/orders')) {
  console.log(`${element?.label} calls nothing in the Warehouse.`)
  process.exit(0)
}

const WAREHOUSE = 'https://github.com/radicaltools/radical.sdlc.demo.warehouse.git'
const copy = mkdtempSync(join(tmpdir(), 'warehouse-'))
try {
  execFileSync('git', ['clone', '-q', '--depth', '1', WAREHOUSE, copy], { stdio: 'inherit' })
  const problems = Object.values(WAREHOUSE_CALLS).flatMap(({ service, method, path }) => {
    const described = parse(readFileSync(join(copy, 'services', service, 'openapi.yaml'), 'utf8')).paths?.[path]?.[method.toLowerCase()]
    if (!described) return [`${method} ${path} is not described by the ${service} service`]
    // Only a write can be repeated by mistake, so a read takes no key.
    if (method === 'GET') return []
    const needsKey = (described.parameters ?? []).some((p) => p.in === 'header' && p.name === 'Idempotency-Key')
    return needsKey ? [] : [`${method} ${path} no longer takes an Idempotency-Key`]
  })
  if (problems.length) {
    console.error(`${problems.join('; ')}.`)
    process.exitCode = 1
  } else {
    console.log('Every call to the Warehouse is described.')
  }
} finally {
  rmSync(copy, { recursive: true, force: true })
}
