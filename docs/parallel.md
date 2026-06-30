# Parallel step groups

By default a workflow runs its steps **sequentially**. A **parallel group** runs
several steps **concurrently** — useful for independent work like fanning out
multiple HTTP requests or writing several files at once.

## Syntax

A step is either a normal connector step (`type` + `with`) **or** a parallel
group (`parallel`) — never both. A group lists child steps under `parallel`:

```yaml
name: fan-out
steps:
  - id: fetch_all
    parallel:
      - id: users
        type: http.request
        with:
          url: "https://api.example.com/users"
      - id: orders
        type: http.request
        with:
          url: "https://api.example.com/orders"
  - id: report
    type: agent.prompt
    with:
      prompt: "Summarize {{ steps.users.body }} and {{ steps.orders.body }}"
```

The two `http.request` steps run at the same time; `report` runs afterwards and
can read both of their outputs.

## Semantics

- **Concurrency.** All children start together (via `Promise.all`).
- **Isolation.** Children run against the **same context snapshot** taken before
  the group, so a child **cannot** read a sibling's output (`{{ steps.<sibling> }}`
  interpolates to empty). Reference sibling outputs only in steps *after* the
  group.
- **Results.** Each child's result is stored under its own `id` (e.g.
  `steps.users`, `steps.orders`). The group's `id` is just a container — it does
  not produce a step result of its own.
- **Failure handling.** If any child fails, the group fails and the workflow
  stops. Already-started siblings are awaited to completion first (there is no
  cancellation), so their step records finalize rather than being left mid-run.
- **Per-child config.** `retry`, `timeout`, and `condition` apply to each child
  step individually, exactly as they do for sequential steps. A `condition` on
  the group skips the whole group.
- **Step records.** Each child is recorded as its own step run in storage; the
  group container is not.

> Tip: keep child `id`s unique across the whole workflow — outputs are keyed by
> `id`, so duplicates would overwrite each other.
