# radical.tools.sdlc.demo.3.shop

The Shop, one of the repositories that build one system with one model. [The architecture
repository](https://github.com/radicaltools/radical.tools.sdlc.demo.3.architecture#readme) holds the model
and says how it all fits together. This repository holds code, and two files about the model:

```
.radical/radical.json     which folder builds which element, which test checks which scenario
.radical/reconciled.json  the commit of the model this code has reached
.radical/sensors/         what measures its own fitness functions; the standards' are in .standards/
tools/model.mjs           fetches the model into .radical/model, out of git
```

## How it works with the Warehouse

![A client pays an order. The orders service of the Shop reserves its lines in the Warehouse, and marks it paid once they are held; if they are short or the Warehouse does not answer, it stays placed. When the order is shipped, the Warehouse books the carrier and the Shop keeps the tracking number; if the carrier is down, it stays paid.](docs/order-across.svg)

Each lane is who does the step. A red arrow is a refusal, and the order stays as it was.

Tickets go to [the architecture repository](https://github.com/radicaltools/radical.tools.sdlc.demo.3.architecture#how-a-change-gets-through),
never here. When this repository's part of the model is not built, the coding agent proposes the code in a pull
request, and the Gate decides. When a change crosses both repositories, the Warehouse goes first, because this one calls it.

Paying an order reserves its goods in the [Warehouse](https://github.com/radicaltools/radical.tools.sdlc.demo.3.warehouse)
in the same request (ADR *Payment waits for stock*), and shipping it has the Warehouse book the carrier. Two things
keep the two repositories honest with each other:

- **The model.** One model holds both, with the relations from the orders service to the Warehouse's services, and it
  orders the work.
- **The contract.** The sensor `warehouse-contract` reads the Warehouse's OpenAPI descriptions on its main branch and fails
  a pull request whose call they do not describe.

Tests and `npm run stack` use a stand-in for the Warehouse, so a pull request here does not need it running.

## Left in on purpose

Open findings from the earlier demos, in `.radical/crucible/findings`, wait for the coding agent:
*a discount code named `constructor` is accepted*, *paying, shipping or cancelling an unknown order answers 500*, and more.

## Run it on your machine

```bash
npm ci
npm run standards        # .radical/model (this repository's part), .standards/, and the agents' skills
npm test
npm run stack            # the services on :3001 to :3003, with a stand-in for the Warehouse on :3011
```

The whole model opens in [Radical Studio](https://radical.tools) from the architecture repository.
