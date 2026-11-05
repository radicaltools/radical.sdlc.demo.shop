// F1: POST /events on the notifications service with no body answers 5xx, not 4xx.
// Notifications port 4703. Exit 3 when the problem is there (5xx), 0 when not.
const URL_EVENTS = 'http://localhost:4703/events'

const response = await fetch(URL_EVENTS, { method: 'POST' })
const text = await response.text()
console.log('POST /events with no body ->', response.status, text)

if (response.status >= 500) {
  console.log('PROBLEM: a bad request (no event) answered', response.status, 'instead of a 4xx')
  process.exit(3)
}
console.log('OK: bad request answered', response.status)
process.exit(0)
