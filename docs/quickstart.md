# TaskPipe Quickstart

## Installation

```bash
npm install -g @taskpipe/cli
# or
pnpm add -g @taskpipe/cli
```

## Initialize a Project

```bash
taskpipe init
```

This creates a `workflows/my-workflow.yaml` example file.

## Run a Workflow

```bash
taskpipe run workflows/my-workflow.yaml
```

## Validate a Workflow

```bash
taskpipe validate workflows/my-workflow.yaml
```

## View Logs

```bash
# List recent runs
taskpipe logs

# View a specific run
taskpipe logs --run <run-id>
```

## Manage Secrets

```bash
taskpipe secrets set OPENAI_API_KEY sk-...
taskpipe secrets list
taskpipe secrets remove OPENAI_API_KEY
```

## Start Webhook Server

```bash
taskpipe webhook start --port 3000
```

## Start Schedule Runner

```bash
taskpipe schedule start --dir ./workflows
```

## Generate Workflows with AI

```bash
taskpipe ai "fetch data from an API and send a Slack notification"
taskpipe ai "summarize a markdown file using GPT" --output workflows/summarize.yaml
```
