# Connectors

## http.request

Makes HTTP requests.

```yaml
- id: fetch
  type: http.request
  with:
    method: GET          # GET, POST, PUT, DELETE, PATCH
    url: "https://api.example.com/data"
    headers:
      Authorization: "Bearer {{ secrets.API_KEY }}"
    body:               # for POST/PUT
      key: value
    query:              # query parameters
      page: "1"
```

Result: `{ status, body, headers }`

## log

Logs a message.

```yaml
- id: log_step
  type: log
  with:
    message: "Processing {{ steps.fetch.body.count }} items"
    level: info   # debug, info, warn, error
```

Result: `{ output: <message> }`

## condition

Evaluates a condition.

```yaml
- id: check
  type: condition
  with:
    if: "{{ steps.fetch.status }} == 200"
    then:
      action: proceed
    else:
      action: abort
```

Result: `{ output: true|false, branch: 'then'|'else', result: ... }`

## transform.json

Transforms JSON data.

```yaml
- id: transform
  type: transform.json
  with:
    input: "{{ steps.fetch.body }}"
    template:
      name: "$.user.name"
      email: "$.user.email"
```

Result: `{ output: <transformed> }`

### JSONPath expressions

Instead of a `template`, you can supply an `expression` that runs a JSONPath
query against `input`. The result is **always an array of matches** (empty when
nothing matches), so the output shape is predictable for any path.

```yaml
- id: active_names
  type: transform.json
  with:
    input: "{{ steps.fetch.body }}"
    expression: "$.items[?(@.active==true)].name"
# output: ["alice", "carol"]
```

Supported syntax (a safe, eval-free subset):

| Syntax | Meaning |
|---|---|
| `$` | the root value |
| `.name` / `['name']` | member access (dot or bracket) |
| `[n]` | array index (negative counts from the end) |
| `[*]` / `.*` | wildcard — all array elements or object values |
| `[?(@.path <op> lit)]` | filter array elements; `<op>` ∈ `=== !== == != >= <= > <`, `lit` ∈ `true`/`false`/`null`/number/`'string'` |

If both `expression` and `template` are given, `expression` wins. Unsupported
syntax raises a descriptive error rather than silently mis-evaluating.

## agent.prompt

Calls an AI language model.

```yaml
- id: summarize
  type: agent.prompt
  with:
    model: "gpt-4.1-mini"
    prompt: "Summarize: {{ steps.fetch.body }}"
    systemPrompt: "You are a helpful assistant."
    output:
      format: text   # or json
```

Result: `{ output: <ai response> }`

## file.read

Reads a file.

```yaml
- id: read
  type: file.read
  with:
    path: "./data/input.txt"
    encoding: utf-8
```

Result: `{ output: <file contents> }`

## file.write

Writes to a file.

```yaml
- id: write
  type: file.write
  with:
    path: "./output/result.txt"
    content: "{{ steps.summarize.output }}"
    append: false
```

Result: `{ output: <file path> }`
