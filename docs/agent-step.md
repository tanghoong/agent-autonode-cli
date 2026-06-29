# Agent Step (agent.prompt)

The `agent.prompt` connector lets you call AI language models within workflows.

## Setup

Set your OpenAI API key:

```bash
autonode secrets set OPENAI_API_KEY sk-...
```

Or set it as an environment variable:

```bash
export OPENAI_API_KEY=sk-...
```

## Text Output

```yaml
- id: summarize
  type: agent.prompt
  with:
    model: "gpt-4.1-mini"
    prompt: "Summarize this in 3 sentences: {{ steps.fetch.body }}"
    output:
      format: text
```

Access the result: `{{ steps.summarize.output }}`

## JSON Output

```yaml
- id: classify
  type: agent.prompt
  with:
    model: "gpt-4.1-mini"
    systemPrompt: "You classify support tickets."
    prompt: "Classify: {{ trigger.body.message }}"
    output:
      format: json
```

The response is automatically parsed as JSON. Access fields: `{{ steps.classify.output.label }}`

## Custom Base URL (OpenAI-compatible APIs)

```yaml
- id: local_llm
  type: agent.prompt
  with:
    model: "llama3"
    baseUrl: "http://localhost:11434/v1"
    prompt: "Hello!"
    output:
      format: text
```

Or set globally: `export OPENAI_BASE_URL=http://localhost:11434/v1`

## Supported Models

Any OpenAI-compatible model:
- `gpt-4.1-mini` (default, fast and cost-effective)
- `gpt-4.1`
- `gpt-4o`
- `gpt-3.5-turbo`
- Local models via Ollama or LM Studio
