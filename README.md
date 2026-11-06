# radical.sdlc.demo.shop

**The Shop of [radical.sdlc.demo](https://github.com/radicaltools/radical.sdlc.demo.architecture#readme)**: a customer prices a
cart, places an order, pays and gets it shipped and tracked. Paying and shipping go through the
[Warehouse](https://github.com/radicaltools/radical.sdlc.demo.warehouse), over HTTP.

This repository holds code and no model. The model of the whole system, the Shop and the Warehouse together, is in the
[architecture repository](https://github.com/radicaltools/radical.sdlc.demo.architecture), and so is the pipeline that
brings changes here. Agents write most of the code here, from that model, and a person accepts it.

## What it does

![A client pays an order. The orders service of the Shop reserves its lines in the Warehouse, and marks it paid once they are held; if they are short or the Warehouse does not answer, it stays placed. When the order is shipped, the Warehouse books the carrier and the Shop keeps the tracking number; if the carrier is down, it stays paid.](docs/order-across.svg)

Each lane is who does the step. A red arrow is a refusal, and the order stays as it was.

**The pricing service** (`services/pricing`, port 3001): `POST /quote` prices a cart, with VAT, a discount code, a
discount for a big cart, and shipping, free from a set amount.

**The orders service** (`services/orders`, port 3002) keeps the orders, and follows the order's state machine in the model:

- `POST /orders` places an order at the quoted total, with a delivery address (street, city, postal code and a
  two-letter country, kept in uppercase); a wrong one is refused with 400.
- `POST /orders/{id}/pay` reserves the goods in the Warehouse in the same request (ADR *Payment waits for stock*): no
  reservation, no payment. Short goods leave the order placed and say what is short.
- `POST /orders/{id}/ship` has the Warehouse book the carrier with the address, and keeps the tracking number.
- `POST /orders/{id}/return` takes a shipped order back within 14 days, and has the Warehouse put the goods back;
  `POST /orders/{id}/cancel` cancels a placed order.
- `GET /orders/{id}/tracking` reads from the Warehouse the carrier's status, the estimated delivery date and, once
  delivered, the time of delivery, as the carrier gave them.

**The notifications service** (`services/notifications`, port 3003) records one notification per event of an order.

Each is described in its `openapi.yaml`; `packages/contracts` holds the types they share, with no behaviour.
`WAREHOUSE_CALLS` in `services/orders/src/neighbours.ts` lists what the Shop calls in the Warehouse.

## How the model reaches the code

```
.radical/radical.json     which folder builds which element of the model, which test checks which scenario,
                          and where the model is ("model": the architecture repository)
.radical/reconciled.json  the commit of the model this code has reached
.radical/sensors/         what measures this repository's own fitness functions
tools/model.mjs           fetches the model into .radical/model, out of git
```

The model names this repository's elements: the Shop, its three services and the shared contracts. Those, and all that
hangs on them, are **its part**: the requirements they satisfy, the order's state machine, the scenarios, the decisions
that constrain them and their fitness functions. The `radical` CLI judges this repository on that part only.

A change of the system lives on a branch `change/<n>` here and in the architecture repository. When the model on that
branch asks for something of this part, the pipeline there starts this repository's `reconcile.yml`, after the
Warehouse's when the change needs both, because the Shop calls the Warehouse. Its coding agent reads what changed in the
model (never the ticket), builds it on `change/<n>`, binds the tests to the scenarios, and opens a draft pull request
with the proof of its tests: each test of a changed scenario fails with the code of `main` and passes with the
branch's. What the model does not say, it asks the model agent.

Nobody merges here by hand. A person accepts the whole change on its ticket in the architecture repository, and the
pipeline merges the model and every repository's pull request of it.
[How a change gets through](https://github.com/radicaltools/radical.sdlc.demo.architecture#how-a-change-gets-through) is there.

## The Gate

Every pull request here runs the standards' Gate, the one required check, with no AI: the type check, the tests, the
sensors of the fitness functions triggered on a pull request, a check that each agent stayed in its scope, and
`radical check` of this repository's part. Two sensors keep the Shop and the Warehouse honest with each other:

| Fitness function | Sensor | Runs |
|---|---|---|
| Services stay on their own (standards) | `boundaries` | every pull request, for each service |
| API matches its description (standards) | `openapi` | every pull request |
| Repeated write changes nothing (standards) | `idempotency` | every pull request |
| Calls match the Warehouse API | `warehouse-contract`: each call in `WAREHOUSE_CALLS` is described in the Warehouse's OpenAPI on its `main`, and a write takes a key | every pull request |
| Order crosses the systems | `crosses`: this code with the Warehouse's of the same change, or its `main`, running together; what the Warehouse answers has to come out of the Shop | every pull request |
| Rules hold in random sequences (standards) | `fuzz` | at night: not run in this demo yet |
| Quote speed | `quote-speed`: a 100-line cart priced 31 000 times | at night: not run yet |

The unit tests and `npm run stack` use a stand-in for the Warehouse.

## Built from the model

[The pull request](https://github.com/radicaltools/radical.sdlc.demo.shop/pull/10) that takes the delivery address came
from the coding agent, on `change/22`, with no ticket here. The pipeline started it once the Warehouse had built its
part of the same change. It asked one question, about the status of a refused order, which a person answered, and
carries the proof of its tests. A person accepted it together with the model and the Warehouse's part.

Open findings wait in `.radical/crucible/findings`: *a discount code named `constructor` is accepted*, *paying,
shipping or cancelling an unknown order answers 500*, and more.

## Run it on your machine

```bash
npm ci
npm run standards        # .radical/model, .standards/ at the model's tag, and the agents' skills
npm test
npm run stack            # the services on :3001 to :3003, with a stand-in for the Warehouse on :3011
```

The whole model opens in [Radical Studio](https://radical.tools) from the architecture repository.
