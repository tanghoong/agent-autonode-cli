# forEach loops

A `forEach` step runs a **sub-pipeline once per item** of a runtime array — the
way to fan out over data whose size you don't know when writing the workflow
(unlike a [parallel group](parallel.md), whose branches are fixed in advance).

## Syntax

A step sets exactly one of `type`, `parallel`, or `forEach`.

```yaml
name: enrich-users
steps:
  - id: fetch
    type: http.request
    with: { url: "https://api.example.com/users" }

  - id: enrich
    forEach:
      items: "{{ steps.fetch.body.users }}"   # template → array, or an inline [..]
      as: user                                 # loop variable name (default: item)
      concurrency: 5                            # max items in flight (default: 1)
      steps:
        - id: detail
          type: http.request
          with: { url: "https://api.example.com/users/{{ user.id }}" }

  - id: report
    type: agent.prompt
    with:
      prompt: "Summarize these profiles: {{ steps.enrich.output }}"
```

| Field | Required | Description |
|---|---|---|
| `items` | yes | A template expression resolving to an array, or an inline array. Non-arrays error. |
| `as` | no | Name the current item is bound to in the loop body. Default `item`. |
| `concurrency` | no | Maximum items processed at once. Default `1` (sequential). |
| `steps` | yes | The sub-pipeline run for each item (at least one step). |

## Semantics

- **Per-item scope.** Each iteration runs against the context snapshot taken
  before the loop, plus the loop variable (`{{ user }}` above). Steps inside one
  iteration see each other's outputs; they do **not** see other iterations.
- **Result shape.** The loop is one logical step. Its result is an **array of
  per-item output maps** (keyed by sub-step id), available as
  `{{ steps.<loopId>.output }}`. For the example above, `steps.enrich.output` is
  `[{ detail: { ... } }, { detail: { ... } }, ...]`. Combine it with
  `transform.json` (e.g. a JSONPath `$[*].detail.body`) to reshape.
- **Concurrency.** Up to `concurrency` items run at once; result order always
  matches input order.
- **Failure handling.** If any item fails, the loop fails the workflow.
  New items stop starting, but already-running items settle first (there is no
  cancellation).
- **Step records.** The loop is recorded as a single step run; its per-item
  sub-steps are executed but not individually persisted.

## forEach vs. parallel

| | `parallel` | `forEach` |
|---|---|---|
| Branches | fixed, written in YAML | dynamic, from a runtime array |
| Concurrency | all at once | bounded by `concurrency` |
| Result | each child under its own id | one array under the loop id |

Use `parallel` for a handful of known, distinct steps; use `forEach` to map the
same pipeline over a list.
