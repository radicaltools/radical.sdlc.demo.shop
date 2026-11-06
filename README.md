# radical.sdlc.demo.shop

The Shop, one of the repositories that build one system with one model. [The architecture
repository](https://github.com/radicaltools/radical.sdlc.demo.architecture#readme) holds the model
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

Paying an order reserves its goods in the [Warehouse](https://github.com/radicaltools/radical.sdlc.demo.warehouse)
in the same request (ADR *Payment waits for stock*), and shipping it has the Warehouse book the carrier. Two things
keep the two repositories honest with each other:

- **The model.** One model holds both, with the relations from the orders service to the Warehouse's services, and it
  orders the work.
- **The contract.** The sensor `warehouse-contract` reads the Warehouse's OpenAPI descriptions on its main branch and fails
  a pull request whose call they do not describe.
- **The test of the two together.** The sensor `crosses` runs this repository's code with the Warehouse's code on the same
  change's branch, or else its main branch, and
  fails a pull request on a call or a field the two sides do not agree on. It starts everything itself.

The tests in `tests/` and `npm run stack` use a stand-in for the Warehouse.

## How a change gets here

![A person opens a ticket. The model agent models the change of the whole system on a branch, says on the ticket what it understood, and a review agent reads the change against the ticket. After a green Gate the system loop starts the Warehouse first, because the Shop calls it, then the Shop, each building on the same branch. A coding agent's question goes to the model agent, who answers in the model, and the loop builds again. When every Gate is green, the evidence goes on the ticket, a person accepts it all at once, and the loop merges the model first, then the code.](https://raw.githubusercontent.com/radicaltools/radical.sdlc.demo.architecture/main/docs/sdlc.svg)

Yellow is a person, violet an agent on Claude Code, and green has no AI and gives the same answer every time. The dark boxes are the Gates, the one required check of each repository.

Tickets go to [the architecture repository](https://github.com/radicaltools/radical.sdlc.demo.architecture#how-a-change-gets-through),
never here. A change lives on the branch `change/<n>` of its ticket, in the architecture repository and in each
repository it touches. When this repository's part of the model on that branch is not built, its coding agent builds
it there, in a draft pull request with the proof of its tests, and the Gate decides. When a change crosses both
repositories, the Warehouse goes first, because this one calls it. Nobody merges here by hand: a person accepts the whole change on its ticket, and the
loop merges every pull request of it.

## Built from the model

[The pull request](https://github.com/radicaltools/radical.sdlc.demo.shop/pull/1) that added the estimated delivery date came from the coding agent, with no ticket here.
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
