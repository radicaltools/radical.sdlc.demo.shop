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

`GET /orders/{id}/tracking` answers a shipped order's tracking number, the carrier's status and the estimated delivery
date, all read from the Warehouse. The date is null when the carrier gave none.

Paying an order reserves its goods in the [Warehouse](https://github.com/radicaltools/radical.tools.sdlc.demo.3.warehouse)
in the same request (ADR *Payment waits for stock*), and shipping it has the Warehouse book the carrier. Two things
keep the two repositories honest with each other:

- **The model.** One model holds both, with the relations from the orders service to the Warehouse's services, and it
  orders the work.
- **The contract.** The sensor `warehouse-contract` reads the Warehouse's OpenAPI descriptions on its main branch and fails
  a pull request whose call they do not describe.
- **The test of the two together.** The sensor `crosses` runs this repository's code with the Warehouse's main branch and
  fails a pull request on a call or a field the two sides do not agree on. It starts everything itself.

The tests in `tests/` and `npm run stack` use a stand-in for the Warehouse.

## How a change gets here

![A person opens a ticket. The model agent changes the model of the whole system in one pull request. A green Gate and a person's merge start the system loop, which reads what each repository has left and starts the Warehouse first, because the Shop calls it. Its coding agent builds its part, a green Gate and a merge start the loop again, and it starts the Shop. When nothing is left, the loop closes the ticket.](https://raw.githubusercontent.com/radicaltools/radical.tools.sdlc.demo.3.architecture/main/docs/sdlc.svg)

Yellow is a person, violet an agent on Claude Code, and green has no AI and gives the same answer every time. The dark box is the Gate, the one required check.

Tickets go to [the architecture repository](https://github.com/radicaltools/radical.tools.sdlc.demo.3.architecture#how-a-change-gets-through),
never here. When this repository's part of the model is not built, the coding agent proposes the code in a pull
request, and the Gate decides. When a change crosses both repositories, the Warehouse goes first, because this one calls it.

## Built from the model

[The pull request](https://github.com/radicaltools/radical.tools.sdlc.demo.3.shop/pull/1) that added the estimated delivery date came from the coding agent, with no ticket here.
The loop started it when the Warehouse's code was merged, so what it needed was already there. It read what changed in
the model, built this repository's part, and left the Warehouse's part alone.

Open findings wait in `.radical/crucible/findings`:
*a discount code named `constructor` is accepted*, *paying, shipping or cancelling an unknown order answers 500*, and more.

## Run it on your machine

```bash
npm ci
npm run standards        # .radical/model (this repository's part), .standards/, and the agents' skills
npm test
npm run stack            # the services on :3001 to :3003, with a stand-in for the Warehouse on :3011
```

The whole model opens in [Radical Studio](https://radical.tools) from the architecture repository.
