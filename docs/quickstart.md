# Autonode Quickstart

## Installation

```bash
npm install -g @autonode/cli
# or
pnpm add -g @autonode/cli
```

## Initialize a Project

```bash
autonode init
```

This creates a `workflows/my-workflow.yaml` example file.

## Run a Workflow

```bash
autonode run workflows/my-workflow.yaml
```

## Validate a Workflow

```bash
autonode validate workflows/my-workflow.yaml
```

## View Logs

```bash
# List recent runs
autonode logs

# View a specific run
autonode logs --run <run-id>
```

## Manage Secrets

```bash
autonode secrets set OPENAI_API_KEY sk-...
autonode secrets list
autonode secrets remove OPENAI_API_KEY
```

## Start Webhook Server

```bash
autonode webhook start --port 3000
```

## Start Schedule Runner

```bash
autonode schedule start --dir ./workflows
```

## Generate Workflows with AI

```bash
autonode ai "fetch data from an API and send a Slack notification"
autonode ai "summarize a markdown file using GPT" --output workflows/summarize.yaml
```
