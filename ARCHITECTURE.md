# Architecture

## Overview
A background job processing system: an API accepts jobs, a queue durably
holds them, a worker executes them independently with automatic retries,
and a dashboard shows live status via WebSockets. Job types currently
supported: webhook delivery and delayed execution.

## Why BullMQ + Redis instead of building the queue myself
BullMQ (backed by Redis) handles the genuinely hard, easy-to-get-wrong parts
of a queue: safely handing one job to exactly one worker, delayed retries,
and backoff timing. Rolling this myself with Postgres row-locking
(`SELECT ... FOR UPDATE SKIP LOCKED`) was the alternative I considered — it
would demonstrate deeper systems understanding, but risks reinventing
something Redis-backed queues already solve well, in a timeframe where
correctness mattered more than originality.
[Your take: which would you reach for on a production team, and why?]

## Data model: Postgres as source of truth, Redis as execution engine
Every job gets a durable row in Postgres the moment it's submitted — before
it's even queued. Redis/BullMQ only tracks *execution* state. This means the
full history of every job (including ones that failed all retries) survives
independently of the queue's internal state.

## Retry strategy
Jobs retry up to 5 times with exponential backoff (2s, 4s, 8s...) before
being marked permanently failed. [Your take: what would you change this to
for jobs with side effects, like charging a card, where retrying blindly is
dangerous? This is a real question interviewers ask — worth having an answer.]

## Real-time updates: "something changed, refetch" vs. pushing full state
Rather than pushing exact job diffs over the socket, the API just notifies
the dashboard that *something* changed, and the dashboard re-fetches the
full job list. [Your take: at what job volume would this stop being a
reasonable simplification, and what would you do instead?]

## What I'd do differently at scale
[This is genuinely worth thinking through, not just for interviews —
partitioning by job type, horizontal scaling of workers, and idempotency
keys to prevent duplicate side effects on retry are all real next steps
for a system like this.]