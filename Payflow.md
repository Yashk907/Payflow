# PayFlow: Payment Gateway & Ledger — Project Draft

Sep 27, 2026 · **@yash**

## Overview

PayFlow is a simplified Razorpay/Stripe: merchants integrate its API to accept online payments, and PayFlow handles the bank, the money records, and the notifications. The goal is to learn backend depth (concurrency, failure handling, async systems) through a domain where mistakes are visible.

**Users**

* **Merchants** sign up, get API keys, create orders, receive webhooks, and view payments, refunds and balances.
* **Customers** pay on a hosted checkout page.
* **Simulated bank** approves, declines, or times out, with configurable failure rates and latency.

**Goals**

* Never charge a customer twice, even under retries and concurrent requests.
* Every rupee is traceable through a double-entry ledger that always balances.
* No payment or webhook is lost when a worker, the bank, or a merchant endpoint fails.
* Measured performance: throughput and p99 latency from k6 load tests.

**Non-goals**

* Real card networks, real money, PCI compliance, or a polished frontend.
* Multi-currency. All amounts are INR, stored as integer paise.

## Core flows

Three flows cover the whole product: pay, refund, settle. Every step that touches money is one database transaction.

**Payment**

1. Merchant backend calls `POST /v1/orders` with amount and an `Idempotency-Key`.
2. Customer opens the hosted checkout and submits test card details.
3. PayFlow creates a payment in `created`, then calls the bank to authorize.
4. Bank responds approved, declined, or times out. A timeout moves the payment to `unknown`.
5. On approval, PayFlow captures, writes ledger entries (customer → platform → merchant, minus fee), and writes an outbox event in the same transaction.
6. A worker publishes the event and delivers a signed `payment.captured` webhook to the merchant.

**Refund**

1. Merchant calls `POST /v1/payments/:id/refunds` (full or partial).
2. PayFlow checks the refundable amount under a row lock, then asks the bank to reverse.
3. On success, reversing ledger entries are written and a `refund.processed` webhook is sent. On failure, the refund is marked failed and the reserved amount is released.

**Settlement**

1. A daily job sums each merchant's captured balance minus refunds and fees.
2. It writes a settlement record and ledger entries moving money to the merchant's payout account.
3. The merchant receives a `settlement.completed` webhook.

## Architecture

One stateless API service scaled horizontally, Postgres as the single source of truth for money, Redis for fast shared state, and workers for anything slow or retryable.

[embed: node/c98fa4bc-8b8c]

The API never calls merchant endpoints directly. It writes an outbox row in the payment's transaction, and workers handle delivery, so a crash never loses an event. The bank is a separate service so its failures are real network failures, not mocked function calls.

## Tech stack

Node.js with TypeScript on top of Postgres and Redis. Each choice is picked to teach something, not for convenience.


| Layer           | Choice                 | Why                                                                     |
| --------------- | ---------------------- | ----------------------------------------------------------------------- |
| Language        | Node.js + TypeScript   | Strict types for money logic; your chosen primary stack                 |
| Framework       | Express                | You already know it, huge ecosystem; add Zod for request validation     |
| Database        | PostgreSQL             | ACID transactions, row locks, constraints for the ledger                |
| DB access       | Knex or raw SQL        | You write locking queries yourself instead of hiding them behind an ORM |
| Cache and state | Redis                  | Atomic Lua scripts for rate limits, idempotency key storage             |
| Queue           | BullMQ                 | Retries, backoff, delayed jobs, dead-letter handling on Redis           |
| Load balancer   | Nginx                  | Run and test multiple API instances                                     |
| Containers      | Docker Compose         | API, workers, bank, Postgres, Redis in one command                      |
| Logging         | Pino                   | Structured JSON logs with request IDs                                   |
| Metrics         | Prometheus + Grafana   | Throughput, latency, queue depth dashboards                             |
| Tracing         | OpenTelemetry + Jaeger | Follow one payment across API, worker and bank                          |
| Testing         | Jest + Testcontainers  | Integration and concurrency tests against real Postgres                 |
| Load testing    | k6                     | Throughput and p99 numbers for the README                               |
| CI              | GitHub Actions         | Lint, test, build on every push                                         |

## Data model

Ten tables. The ledger is append-only, and balances are always computed from ledger entries, never stored as an editable number. All amounts are `BIGINT` paise.


| Table                | Key columns                                                                | Constraints that matter                                     |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `merchants`          | id, name, email, webhook\_url, webhook\_secret, status                     | Unique email                                                |
| `api_keys`           | id, merchant\_id, key\_prefix, key\_hash, revoked\_at                      | Only the hash is stored; prefix used for lookup             |
| `orders`             | id, merchant\_id, amount, currency, receipt, status                        | amount > 0                                                  |
| `payments`           | id, order\_id, amount, status, bank\_ref, failure\_reason, version         | Status transitions enforced;`version`for optimistic locking |
| `refunds`            | id, payment\_id, amount, status                                            | Sum of refunds ≤ captured amount, checked under row lock   |
| `ledger_accounts`    | id, owner\_type, owner\_id, type (asset, liability, revenue)               | One account per owner and type                              |
| `ledger_entries`     | id, transaction\_id, account\_id, direction (debit, credit), amount        | Append-only; every transaction\_id sums to zero             |
| `idempotency_keys`   | merchant\_id, key, request\_hash, response, status, expires\_at            | Primary key (merchant\_id, key)                             |
| `outbox_events`      | id, aggregate\_id, event\_type, payload, published\_at                     | Written in the same transaction as the change               |
| `webhook_deliveries` | id, event\_id, merchant\_id, attempt, status, next\_retry\_at, last\_error | One row per attempt for auditing                            |

A scheduled invariant check runs `SUM(debits) = SUM(credits)` across the whole ledger and alerts on any mismatch.

## Payment state machine

Every payment follows six states, and illegal transitions are rejected by the database, not just the code.

[embed: node/9102125b-2a8b]

Partial refunds keep the payment in `captured` and track `refunded_amount`; a refund covering the full amount moves it to `refunded`. Transitions use `UPDATE ... WHERE status = <expected>` so two concurrent updates can't both succeed.

## API design

A REST API versioned under `/v1`, authenticated with `Authorization: Bearer <api_key>`. Every POST that moves money requires an `Idempotency-Key` header.


| Method | Endpoint                   | Purpose                                         |
| ------ | -------------------------- | ----------------------------------------------- |
| POST   | `/v1/merchants`            | Sign up, returns first API key once             |
| POST   | `/v1/api-keys`             | Create or rotate a key                          |
| POST   | `/v1/orders`               | Create an order                                 |
| GET    | `/v1/orders/:id`           | Fetch order with its payments                   |
| POST   | `/v1/payments`             | Start payment for an order (called by checkout) |
| GET    | `/v1/payments/:id`         | Payment status                                  |
| POST   | `/v1/payments/:id/refunds` | Full or partial refund                          |
| GET    | `/v1/balance`              | Merchant balance, computed from ledger          |
| GET    | `/v1/settlements`          | Past settlements                                |
| POST   | `/v1/webhook-endpoints`    | Register webhook URL, returns signing secret    |
| POST   | `/v1/events/:id/replay`    | Redeliver a webhook                             |
| GET    | `/checkout/:order_id`      | Hosted checkout page                            |
| GET    | `/health`,`/metrics`       | Liveness and Prometheus metrics                 |

Errors use one shape: `{ "error": { "code", "message", "request_id" } }`. Rate-limited requests return `429` with `Retry-After` and `X-RateLimit-Remaining` headers.

## Key design decisions

Six mechanisms make PayFlow correct under failure. Each is a likely interview question, so write down the trade-off you chose.

**Idempotency**

On a request with `Idempotency-Key`, insert a row keyed on (merchant\_id, key) with status `in_progress` and a hash of the request body. The unique constraint means a concurrent duplicate fails the insert and gets `409` while the first is running. When done, store the response; later duplicates get the stored response. A reused key with a different body gets `422`. Keys expire after 24 hours.

**Double-entry ledger**

Every money movement is one ledger transaction with at least two entries whose debits equal credits. A ₹500 capture with a 2% fee credits the merchant ₹490 and platform revenue ₹10, balanced by a ₹500 debit. Entries are never updated or deleted; mistakes are fixed with reversing entries.

**Transactional outbox**

The payment update, ledger entries, and outbox event commit in one transaction. The relay worker polls unpublished rows with `SELECT ... FOR UPDATE SKIP LOCKED`, pushes them to BullMQ, and marks them published. Delivery is at-least-once, so webhooks carry an event ID that merchants use to deduplicate.

**Rate limiting**

Per-merchant limits run as atomic Redis Lua scripts. Implement both token bucket (allows bursts) and sliding window counter (smoother), benchmark them, and document when each fits. Separate, stricter limits apply to login and key creation.

**Reconciliation**

When the bank times out, the payment goes to `unknown` instead of guessing. A job every few minutes asks the bank for the status of each `unknown` payment by reference and moves it to `authorized` or `failed`. A nightly job compares PayFlow's records against the bank's full report and flags mismatches.

**Webhook delivery**

Payloads are signed with HMAC-SHA256 using the merchant's secret, with a timestamp to block replays. Failed deliveries retry with exponential backoff and jitter (about 8 attempts over 24 hours), then land in a dead-letter queue viewable and replayable from the API. A circuit breaker per endpoint pauses delivery to consistently failing merchants.

## Roadmap

About 13 weeks at internship pace, including one week to learn TypeScript. Each phase ends with something working and demoable. If time runs short, Phases 1–4 alone are a strong project; never skip Phase 2.


| Phase                    | Weeks | Build                                                                                                                                                                                                | You learn                                                                     |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 0. TypeScript + design   | 1.5   | TS basics from the Handbook (types, interfaces, unions, generics, tsconfig), convert a small Express + Postgres app to TS with strict mode; then schema, state machine, API list, this doc finalized | TypeScript fundamentals, designing before coding                              |
| 1. Core API + fake bank  | 2     | Merchant signup, hashed API keys, orders, payments, bank service with failure injection, Docker Compose                                                                                              | Express, Postgres, auth, service-to-service calls                             |
| 2. Ledger + idempotency  | 2     | Double-entry ledger, balance endpoint, idempotency keys, concurrency tests                                                                                                                           | Transactions, isolation levels, row locks, constraints as concurrency control |
| 3. Async + webhooks      | 2     | Outbox, relay worker, BullMQ, signed webhooks, retries, DLQ, replay                                                                                                                                  | Queues, at-least-once delivery, HMAC                                          |
| 4. Resilience            | 1.5   | Rate limiting (two algorithms), timeouts, circuit breaker,`unknown`state, reconciliation job                                                                                                         | Redis Lua, failure handling, distributed-systems thinking                     |
| 5. Refunds + settlement  | 1     | Partial and full refunds, daily settlement job                                                                                                                                                       | Sagas, compensation, batch jobs                                               |
| 6. Observability + scale | 1.5   | Pino logs, Prometheus, Grafana, OpenTelemetry, 3 API instances behind Nginx, k6 tests, chaos tests                                                                                                   | Production operations, measuring performance                                  |
| 7. Showcase              | 0.5   | README with diagrams and benchmarks, demo video, deploy                                                                                                                                              | Communicating engineering work                                                |

## Testing and success metrics

The project is done when these tests pass and the numbers are measured, not estimated. These numbers become the resume bullets.

**Tests that prove correctness**

* **Duplicate charge test:** fire 100 concurrent requests with the same idempotency key; exactly one payment and one set of ledger entries exist.
* **Refund race test:** fire concurrent refunds that together exceed the captured amount; the total refunded never exceeds it.
* **Ledger invariant test:** after every test suite and load test, debits equal credits.
* **Crash test:** kill the relay or webhook worker mid-job; after restart, every event is delivered and none is lost.
* **Bank chaos test:** run with 20% bank failures and 5% timeouts; every payment ends in a final state after reconciliation.
* **Webhook failure test:** point a merchant at an endpoint that fails 50% of the time; all events are eventually delivered or in the DLQ.

**Metrics to record in the README**

* Sustained requests per second and p50/p99 latency for payment creation (k6, 3 API instances).
* Rate limiter overhead per request for each algorithm.
* Webhook delivery success rate and median time to delivery under endpoint failures.
* Duplicate charges observed across all tests (target: zero).

## Repo structure

One monorepo with three deployable apps sharing a common package.

```
payflow/
├── apps/
│   ├── api/            # Express API: routes, auth, rate limiting, checkout page
│   ├── worker/         # outbox relay, webhook delivery, reconciliation, settlement
│   └── bank/           # simulated bank with failure injection
├── packages/
│   └── core/           # ledger, state machine, idempotency, db client, shared types
├── db/
│   └── migrations/     # Knex migrations, one per schema change
├── infra/
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── grafana/        # dashboards as JSON
├── tests/
│   ├── integration/
│   ├── concurrency/    # duplicate charge, refund race
│   └── load/           # k6 scripts
├── docs/
│   ├── design.md       # this doc, kept up to date
│   └── decisions/      # one short note per major design decision
└── README.md
```
