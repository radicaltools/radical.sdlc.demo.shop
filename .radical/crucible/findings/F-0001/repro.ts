// Unknown code refused: a code named after an Object.prototype key.
import { buildServer } from '../../../../services/pricing/src/server.js'

const app = buildServer()
const lines = [{ sku: 'mug', unitPrice: 20, quantity: 1 }]
for (const code of ['constructor', 'toString', 'NOPE']) {
  const res = await app.inject({ method: 'POST', url: '/quote', payload: { lines, code } })
  console.log(JSON.stringify({ code, status: res.statusCode, body: res.body }))
}
await app.close()
