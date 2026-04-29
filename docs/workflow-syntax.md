# Workflow Syntax

## Basic Structure

```yaml
name: my-workflow

trigger:       # optional
  type: schedule.trigger
  with:
    cron: "0 9 * * *"

steps:
  - id: step_id
    type: connector_type
    with:
      key: value
    retry:
      attempts: 3
      delay: 1000
    timeout: 30000
```

## Triggers

### Schedule Trigger

```yaml
trigger:
  type: schedule.trigger
  with:
    cron: "0 9 * * *"   # 9 AM every day
```

### Webhook Trigger

```yaml
trigger:
  type: webhook.trigger
  with:
    path: /webhook/my-hook
```

## Steps

Each step requires:
- `id`: unique identifier (alphanumeric + underscore)
- `type`: connector type

Optional:
- `with`: connector configuration
- `retry.attempts`: number of retry attempts
- `retry.delay`: delay between retries in ms
- `timeout`: step timeout in ms

## Variable Interpolation

Use `{{ ... }}` to reference values:

```yaml
steps:
  - id: fetch
    type: http.request
    with:
      url: "https://api.example.com"

  - id: log
    type: log
    with:
      message: "Status: {{ steps.fetch.status }}"
```

Available variables:
- `{{ steps.<id>.<field> }}` - previous step result
- `{{ trigger.body.<field> }}` - webhook trigger body
- `{{ trigger.headers.<name> }}` - webhook headers
- `{{ trigger.query.<param> }}` - query parameters
- `{{ env.<VAR> }}` - environment variables
- `{{ secrets.<KEY> }}` - secrets

## Error Handling

```yaml
steps:
  - id: api_call
    type: http.request
    retry:
      attempts: 3
      delay: 5000
    timeout: 30000
    with:
      url: "https://api.example.com"
```
