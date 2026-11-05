// The rules of the shop over random sequences of requests across the three services
// (ADR Rules hold under any sequence), written with Radical Crucible's engine and run by
// radical fuzz: on fixed seeds with every change, on a random seed and 2000 runs at night.
// A failure shrinks to the shortest sequence that breaks the rule.
//
// KNOWN lists the open findings that break a rule. A run that hits one ends quietly, so
// the Gate stays green until the fix: remove the entry with the fix, and the rule holds it
// from then on. `radical fuzz --no-known` shows whether one still happens.

import { fc, loadFindings, type FuzzSuite, type Known } from '@radicaltools/crucible'
import { fuzzSuite } from '@radicaltools/crucible/vitest'
import type { Line, OrderStatus } from '@shop/contracts'
import { buildServer as notifications } from '../../services/notifications/src/server.js'
import { Refused, buildServer as orders } from '../../services/orders/src/server.js'
import { buildServer as pricing } from '../../services/pricing/src/server.js'

const MOVES = {
  pay: { to: 'paid', from: 'placed', event: 'order.paid' },
  ship: { to: 'shipped', from: 'paid', event: 'order.shipped' },
  cancel: { to: 'cancelled', from: 'placed', event: 'order.cancelled' },
} as const

type Move = keyof typeof MOVES
type Action =
  | { a: 'place'; lines: Line[]; code?: string }
  | { a: Move; which: number }
  | { a: 'read'; which: number }

const line: fc.Arbitrary<Line> = fc.record({
  sku: fc.constantFrom('mug', 'beans', 'grinder'),
  unitPrice: fc.integer({ min: 1, max: 40000 }).map((cents) => cents / 100),
  quantity: fc.oneof(fc.integer({ min: 1, max: 9 }), fc.constantFrom(0, -1, undefined as unknown as number)),
})
const actions: fc.Arbitrary<Action> = fc.oneof(
  { weight: 2, arbitrary: fc.record({ a: fc.constant('place' as const), lines: fc.array(line, { maxLength: 4 }), code: fc.constantFrom('WELCOME10', 'LOYAL20', 'NOPE', 'constructor', 'toString', undefined) }) },
  { weight: 3, arbitrary: fc.record({ a: fc.constantFrom('pay' as const, 'ship' as const, 'cancel' as const), which: fc.integer({ min: -1, max: 5 }) }) },
  { weight: 1, arbitrary: fc.record({ a: fc.constant('read' as const), which: fc.integer({ min: -1, max: 5 }) }) },
)

const placing = (action: Action | undefined) => (action?.a === 'place' ? action : undefined)
const KNOWN: Known<Action>[] = [
  { rule: 'moneyIsSane', last: 'place', finding: 'F-0001', note: 'a discount code named after an Object key prices the cart as null',
    match: ({ actions: done }) => ['constructor', 'toString'].includes(placing(done.at(-1))?.code ?? '') },
  { rule: 'noServerError', last: ['pay', 'ship', 'cancel'], finding: 'F-0002', note: 'a move of an unknown order answers 500',
    match: ({ actions: done }) => (done.at(-1) as { which: number }).which < 0 },
  { rule: 'moneyIsSane', last: 'place', finding: 'F-0003', note: 'a line with no quantity is priced as null',
    match: ({ actions: done }) => placing(done.at(-1))?.lines.some((l) => l.quantity === undefined) ?? false },
]

const isMoney = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6

interface Run {
  orders: ReturnType<typeof orders>
  told: ReturnType<typeof notifications>
  priced: ReturnType<typeof pricing>
  known: { id: string; status: OrderStatus; events: string[] }[]
}

const suite: FuzzSuite<Action, null, Run> = {
  name: 'shop',
  file: 'tests/fuzz/shop.fuzz.test.ts',
  rules: ['noServerError', 'moneyIsSane', 'lifecycleHolds', 'notifiedOnce'],
  actions,
  worlds: { shop: { seed: 20261103, runs: 40, maxLength: 12 } },
  known: KNOWN,
  prepare: () => null,
  start() {
    const priced = pricing()
    const told = notifications()
    const app = orders({
      async price(lines, code) {
        const response = await priced.inject({ method: 'POST', url: '/quote', payload: { lines, code } })
        if (response.statusCode === 400) throw new Refused(response.json().error)
        if (response.statusCode !== 200) throw new Error(`Pricing answered ${response.statusCode}`)
        return response.json()
      },
      async notify(event) {
        await told.inject({ method: 'POST', url: '/events', payload: event })
      },
      // The Warehouse has its own rules and its own fuzz file; here it always has the goods.
      reserve: async (orderId) => `r-${orderId}`,
      dispatch: async (orderId) => `T-${orderId}`,
      return: async () => {},
      carrierStatus: async (reservationId) => ({ trackingNumber: `T-${reservationId}`, status: 'in-transit', estimatedDeliveryDate: null, deliveredAt: null }),
    })
    return { orders: app, told, priced, known: [] }
  },
  async step(run, action, ctx) {
    ctx.actions.push(action)
    const noServerError = (status: number, what: string) => {
      if (status >= 500) ctx.fail({ rule: 'noServerError', detail: `${what} answered ${status}` })
    }
    if (action.a === 'place') {
      const response = await run.orders.inject({ method: 'POST', url: '/orders', payload: { lines: action.lines, code: action.code } })
      ctx.trace.push(`place: ${response.statusCode}`)
      noServerError(response.statusCode, 'placing an order')
      if (response.statusCode === 201) {
        const order = response.json()
        run.known.push({ id: order.id, status: 'placed', events: ['order.placed'] })
        if (!isMoney(order.total)) ctx.fail({ rule: 'moneyIsSane', detail: `the order came to ${order.total}` })
      }
    } else {
      const order = action.which < 0 ? undefined : run.known[action.which % run.known.length]
      if (action.which >= 0 && !order) {
        ctx.trace.push(`${action.a}: no order yet`)
        return
      }
      const id = order?.id ?? 'o-999'
      if (action.a === 'read') {
        const response = await run.orders.inject({ method: 'GET', url: `/orders/${id}` })
        ctx.trace.push(`read ${id}: ${response.statusCode}`)
        noServerError(response.statusCode, `reading ${id}`)
        if (order && response.json().status !== order.status) ctx.fail({ rule: 'lifecycleHolds', detail: `${id} reads ${response.json().status}, expected ${order.status}` })
      } else {
        const { to, from, event } = MOVES[action.a]
        const response = await run.orders.inject({ method: 'POST', url: `/orders/${id}/${action.a}` })
        ctx.trace.push(`${action.a} ${id}: ${response.statusCode}`)
        noServerError(response.statusCode, `${action.a} of ${id}`)
        if (order) {
          // Paying a paid order again answers that it is paid, and moves nothing.
          const allowed = order.status === from
          const repeated = action.a === 'pay' && order.status === 'paid'
          if ((allowed || repeated) !== (response.statusCode === 200)) ctx.fail({ rule: 'lifecycleHolds', detail: `${action.a} of a ${order.status} order answered ${response.statusCode}` })
          if (allowed) {
            order.status = to
            order.events.push(event)
          }
        }
      }
    }
    for (const order of run.known) {
      const notes = (await run.told.inject({ method: 'GET', url: `/notifications?orderId=${order.id}` })).json() as { eventId: string }[]
      const got = notes.map((n) => n.eventId).sort()
      const expected = order.events.map((e) => `${order.id}:${e}`).sort()
      if (JSON.stringify(got) !== JSON.stringify(expected)) ctx.fail({ rule: 'notifiedOnce', detail: `${order.id}: told ${got}, expected ${expected}` })
    }
  },
  async end(run) {
    await Promise.all([run.priced.close(), run.told.close(), run.orders.close()])
  },
  isNoOp: (resolved) => resolved.includes('no order yet'),
}

fuzzSuite(suite, { title: 'shop rules', findings: await loadFindings('.radical/crucible/findings') })
