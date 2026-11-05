// F2: GET /notifications with no orderId is answered as a success (an empty list)
// instead of a 4xx, although orderId is required in services/notifications/openapi.yaml.
// Exits 3 when the problem is there, 0 when it is not.
const BASE = 'http://localhost:4703'

const response = await fetch(`${BASE}/notifications`)
const body = await response.text()

console.log(`GET /notifications (no orderId): ${response.status} ${body}`)
const problem = response.status < 400
console.log(problem ? 'PROBLEM: a request without the required orderId is answered as a success' : 'no problem')
process.exit(problem ? 3 : 0)
