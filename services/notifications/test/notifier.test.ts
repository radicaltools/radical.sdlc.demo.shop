import { describe, expect, it } from 'vitest'
import { Notifier } from '../src/notifier.js'

const paid = { id: 'o-1:order.paid', type: 'order.paid', orderId: 'o-1' } as const

describe('notifier', () => {
  it('records a notification for an event', () => {
    const notifier = new Notifier()
    notifier.handle(paid)
    expect(notifier.of('o-1')).toEqual([{ eventId: paid.id, orderId: 'o-1', text: 'Your payment arrived.' }])
  })
  it('ignores a repeated event', () => {
    const notifier = new Notifier()
    notifier.handle(paid)
    notifier.handle(paid)
    expect(notifier.of('o-1')).toHaveLength(1)
  })
})
