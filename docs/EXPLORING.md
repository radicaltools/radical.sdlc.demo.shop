# Exploring the shop

The brief of an exploratory round (Radical Crucible). The shop runs on real ports, and
you use it as a client would, over HTTP. Its model says what must hold.

## How to tell that something is wrong

- A requirement of the model does not hold. Its EARS text is the rule, and a scenario is
  only one example of it. Look at what the rule says beyond the example.
- A request gets a 5xx answer. A bad request is the client's mistake and gets a 4xx.
- A price, a discount or a total is not a number, is negative, or has more than two decimals.
- An order moves in a way its lifecycle does not allow, or a refused request changed something.
- A customer is told twice about one event, or not at all about one that happened.

## Where to look

Inputs no test tries: zero, negative, huge, fractional, empty, missing, the wrong type,
names like `constructor`. Every route, not only the one a scenario names. The same call
twice, and steps out of order.

## How to drive it

Write small `.mjs` scripts with `fetch`, in your run's folder. Each one reproduces one
problem: it prints what it saw, and exits with status 3 when the problem is there and 0
when it is not. The ports are in your prompt: the app port is the orders service, the hub
port is pricing, and the other port is notifications. Behind the orders service is a
stand-in for the Warehouse, which always has the goods.
