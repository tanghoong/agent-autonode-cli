# TaskPipe

> **A YAML-driven workflow automation CLI powered by AI** — define pipelines in plain YAML, run them on a schedule, trigger them via webhook, or generate them from natural language using an LLM.

[![CI](https://github.com/tanghoong/agent-autonode-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tanghoong/agent-autonode-cli/actions/workflows/ci.yml)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![pnpm >=8](https://img.shields.io/badge/pnpm-%3E%3D8-orange)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Reference](#cli-reference)
- [Workflow Syntax](#workflow-syntax)
- [Built-in Connectors](#built-in-connectors)
- [Template Interpolation](#template-interpolation)
- [Example Workflows](#example-workflows)
- [Docker](#docker)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## Overview

**TaskPipe** is a developer-friendly automation engine that lets you orchestrate multi-step workflows using simple YAML files. Each workflow is a sequence of *steps*, where each step calls a *connector* — a typed, reusable action such as making an HTTP request, reading a file, calling an AI model, or evaluating a condition.

```
┌─────────────┐   YAML   ┌──────────────────┐   Steps   ┌────────────────────┐
│  Developer  │ ───────► │  Workflow Engine  │ ────────► │  Connectors / LLM  │
└─────────────┘          └──────────────────┘           └────────────────────┘
                               │        ▲
                        Trigger│        │Results
                               ▼        │
                  ┌──────────────────────────────┐
                  │  CLI / Webhook / Cron / AI    │
                  └──────────────────────────────┘
```

**Key use cases:**
- Scheduled reporting and data pipeline jobs
- Webhook-triggered event processing
- AI-assisted content generation and summarisation
- API health monitoring
- GitHub issue triage automation
- Form submission routing

---

## Features

| Category | Highlights |
|---|---|
| **Workflow Engine** | YAML parsing, `{{ }}` template interpolation, sequential execution, per-step retry & timeout |
| **Triggers** | `schedule.trigger` (cron), `webhook.trigger` (HTTP endpoint), manual `run` |
| **Connectors (7)** | `http.request`, `log`, `condition`, `transform.json`, `agent.prompt`, `file.read`, `file.write` |
| **LLM / AI** | OpenAI-compatible API, text & JSON output modes, AI workflow generation from natural language |
| **CLI Commands (8)** | `init`, `run`, `validate`, `logs`, `secrets`, `webhook`, `schedule`, `ai` |
| **Storage** | SQLite persistence for run history and step-level audit trail |
| **Secrets** | File-based secret store (`~/.taskpipe/secrets.json`), accessible in templates via `{{ secrets.KEY }}` |
| **DevOps** | Dockerfile, docker-compose, GitHub Actions CI |

---

## Architecture

TaskPipe is a **pnpm monorepo** composed of focused packages:

```
taskpipe/
├── apps/
│   └── cli/               # Commander.js CLI — 8 commands
└── packages/
    ├── shared/            # Common types, Zod schemas, logger
    ├── engine/            # YAML parser, validator, executor, interpolation
    ├── connectors/        # 7 built-in step connectors
    ├── storage/           # SQLite persistence (better-sqlite3)
    └── agent/             # LLM provider client (OpenAI-compatible)
```

**Data flow for a single workflow run:**

```
taskpipe run workflow.yaml
        │
        ▼
  engine: parse & validate YAML
        │
        ▼
  engine: execute steps sequentially
        │  ┌─────────────────────────────────┐
        ├─►│ interpolate {{ }} templates      │
        │  └─────────────────────────────────┘
        │  ┌─────────────────────────────────┐
        ├─►│ dispatch to connector           │
        │  └─────────────────────────────────┘
        │  ┌─────────────────────────────────┐
        └─►│ persist result to SQLite        │
           └─────────────────────────────────┘
```

---

## Installation

**Prerequisites:** Node.js ≥ 18, pnpm ≥ 8

### From npm (once published)

```bash
npm install -g @taskpipe/cli
# or
pnpm add -g @taskpipe/cli
```

### From source

```bash
git clone https://github.com/tanghoong/agent-autonode-cli.git
cd agent-autonode-cli
pnpm install
pnpm build
# The CLI binary is now at apps/cli/dist/index.js
node apps/cli/dist/index.js --help
```

---

## Quick Start

```bash
# 1. Initialise a new project
taskpipe init

# 2. Set an API key (for AI steps)
taskpipe secrets set OPENAI_API_KEY sk-...

# 3. Validate your workflow
taskpipe validate workflows/my-workflow.yaml

# 4. Run it
taskpipe run workflows/my-workflow.yaml

# 5. Inspect the execution log
taskpipe logs
```

---

## CLI Reference

| Command | Description |
|---|---|
| `taskpipe init [--name <n>] [--dir <d>]` | Scaffold a new project with an example workflow |
| `taskpipe run <workflow> [--dry-run] [--db <path>]` | Execute a workflow file |
| `taskpipe validate <workflow>` | Validate YAML syntax and schema |
| `taskpipe logs [--run <id>]` | List all runs or view a specific run's step details |
| `taskpipe secrets set <key> <value>` | Store a secret |
| `taskpipe secrets list` | List stored secret keys |
| `taskpipe secrets remove <key>` | Delete a secret |
| `taskpipe webhook start [--port <p>]` | Start an HTTP webhook server |
| `taskpipe schedule start [--dir <d>]` | Start the cron scheduler for all workflows in a directory |
| `taskpipe ai "<prompt>" [--output <file>] [--model <m>]` | Generate a workflow YAML from natural language |

### Webhook server endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/webhook/:id` | Generic webhook receiver |
| `POST` | `/run/:workflowFile` | Trigger a named workflow file |

---

## Workflow Syntax

```yaml
name: my-workflow           # required

trigger:                    # optional
  type: schedule.trigger    # or webhook.trigger
  with:
    cron: "0 9 * * *"       # standard cron expression

steps:
  - id: fetch               # unique step identifier
    type: http.request      # connector type
    with:
      method: GET
      url: "https://api.example.com/data"
    retry:
      attempts: 3           # retry up to 3 times
      delay: 5000           # 5 s between attempts
    timeout: 30000          # fail if step takes > 30 s

  - id: summarize
    type: agent.prompt
    with:
      model: "gpt-4.1-mini"
      prompt: "Summarise this data: {{ steps.fetch.body }}"
      output:
        format: text
```

### Trigger types

| Type | `with` keys | Description |
|---|---|---|
| `schedule.trigger` | `cron` | Standard cron expression |
| `webhook.trigger` | `path` | HTTP path to listen on |

---

## Built-in Connectors

### `http.request`
Makes HTTP requests (GET, POST, PUT, DELETE, PATCH).

```yaml
type: http.request
with:
  method: POST
  url: "https://api.example.com/data"
  headers:
    Authorization: "Bearer {{ secrets.API_KEY }}"
  body:
    key: value
  query:
    page: "1"
```
**Result:** `{ status, body, headers }`

---

### `log`
Logs a message to the console.

```yaml
type: log
with:
  message: "Processed {{ steps.fetch.body.count }} items"
  level: info   # debug | info | warn | error | success
```
**Result:** `{ output: <message> }`

---

### `condition`
Evaluates a boolean expression and branches accordingly.

```yaml
type: condition
with:
  if: "{{ steps.fetch.status }} == 200"
  then:
    action: proceed
  else:
    action: abort
```
**Result:** `{ output: true|false, branch: 'then'|'else', result: ... }`

---

### `transform.json`
Transforms JSON data using a template mapping.

```yaml
type: transform.json
with:
  input: "{{ steps.fetch.body }}"
  template:
    name: "$.user.name"
    email: "$.user.email"
```
**Result:** `{ output: <transformed object> }`

---

### `agent.prompt`
Calls an OpenAI-compatible LLM.

```yaml
type: agent.prompt
with:
  model: "gpt-4.1-mini"
  prompt: "Summarise: {{ steps.fetch.body }}"
  systemPrompt: "You are a helpful assistant."
  output:
    format: text   # or json
```
**Result:** `{ output: <AI response> }`

---

### `file.read`
Reads the contents of a file.

```yaml
type: file.read
with:
  path: "./data/input.txt"
  encoding: utf-8
```
**Result:** `{ output: <file contents> }`

---

### `file.write`
Writes content to a file.

```yaml
type: file.write
with:
  path: "./output/result.txt"
  content: "{{ steps.summarize.output }}"
  append: false
```
**Result:** `{ output: <file path> }`

---

## Template Interpolation

Use `{{ ... }}` anywhere in `with` values to reference dynamic data:

| Expression | Source |
|---|---|
| `{{ steps.<id>.<field> }}` | Output of a previous step |
| `{{ trigger.body.<field> }}` | Webhook request body |
| `{{ trigger.headers.<name> }}` | Webhook request headers |
| `{{ trigger.query.<param> }}` | Webhook query parameters |
| `{{ env.VAR_NAME }}` | Environment variable |
| `{{ secrets.KEY_NAME }}` | Stored secret |

---

## Example Workflows

Six ready-to-use examples are included in the `examples/` directory:

| File | Trigger | Description |
|---|---|---|
| `daily-ai-summary.yaml` | Cron (9 AM) | Fetch data → AI summary → POST report |
| `webhook-feedback.yaml` | Webhook | Classify incoming customer feedback with LLM |
| `github-issue-triage.yaml` | Webhook | Auto-label and prioritise GitHub issues |
| `local-markdown-summarizer.yaml` | Manual | Read a Markdown file → summarise with AI → write output |
| `api-health-checker.yaml` | Cron | Ping multiple API endpoints and log health status |
| `form-submission-router.yaml` | Webhook | Route form submissions to different handlers by type |

Run any example:

```bash
taskpipe run examples/daily-ai-summary.yaml
```

---

## Docker

### Build and run with Docker

```bash
docker build -t taskpipe .
docker run --rm taskpipe validate workflows/my-workflow.yaml
```

### Local development with docker-compose

```bash
docker-compose up
```

---

## Project Structure

```
agent-autonode-cli/
├── apps/
│   └── cli/                   # @taskpipe/cli — CLI entry point
│       └── src/commands/      # init, run, validate, logs, secrets,
│                              #   webhook, schedule, ai
├── packages/
│   ├── shared/                # @taskpipe/shared — types & schemas (Zod)
│   ├── engine/                # @taskpipe/engine — parser, executor, interpolation
│   ├── connectors/            # @taskpipe/connectors — 7 built-in connectors
│   ├── storage/               # @taskpipe/storage — SQLite run/step persistence
│   └── agent/                 # @taskpipe/agent — LLM client
├── examples/                  # 6 example workflow YAML files
├── docs/                      # Extended documentation
│   ├── quickstart.md
│   ├── workflow-syntax.md
│   ├── connectors.md
│   └── agent-step.md
├── Dockerfile
├── docker-compose.yml
└── package.json               # pnpm workspace root
```

---

## Roadmap

### ✅ v0.1 — MVP (current)

- [x] Monorepo with pnpm workspaces
- [x] YAML workflow engine with `{{ }}` interpolation
- [x] 7 built-in connectors
- [x] 8 CLI commands (`init`, `run`, `validate`, `logs`, `secrets`, `webhook`, `schedule`, `ai`)
- [x] SQLite run history
- [x] OpenAI-compatible LLM integration
- [x] Webhook server + cron scheduler
- [x] AI-powered workflow generation
- [x] Docker + GitHub Actions CI
- [x] 6 example workflows

### 🔄 v0.2 — Quality & Security

- [ ] Unit tests for engine, connectors, and CLI commands
- [ ] Integration tests for end-to-end scenarios
- [ ] ESLint + Prettier configuration
- [ ] Secrets encryption (OS keychain / AES-256)
- [ ] Safe expression evaluator for `condition` connector (replace `new Function()`)
- [ ] HTTP request timeouts and improved network error messages
- [ ] Path traversal protection in `file.read` / `file.write`

### 🚀 v0.3 — Extensibility

- [ ] Plugin / custom connector system (load connectors from npm packages)
- [ ] Step `condition` field evaluation (skip steps dynamically)
- [ ] Parallel step execution groups
- [ ] `transform.json` with JSONPath / jq-style expressions

### 🌐 v0.4 — Integrations & UX

- [ ] Database connectors: PostgreSQL, MySQL, MongoDB
- [ ] Cloud provider steps: AWS S3, GCP Storage, Azure Blob
- [ ] Slack / Discord / email notification connectors
- [ ] Web UI for workflow management and live run monitoring
- [ ] Workflow visualisation (DAG view)
- [ ] OpenTelemetry tracing and performance metrics

### 🏢 v1.0 — Production-Ready

- [ ] Multi-user / team support
- [ ] Role-based access control
- [ ] Encrypted secrets with audit log
- [ ] Workflow versioning and rollback
- [ ] Distributed execution (multi-node)
- [ ] SLA monitoring and alerting
- [ ] Official npm package release

---

## Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a pull request.

```bash
# Clone and install
git clone https://github.com/tanghoong/agent-autonode-cli.git
cd agent-autonode-cli
pnpm install

# Build all packages
pnpm build

# Run the CLI locally
node apps/cli/dist/index.js --help
```

---

## License

MIT © [tanghoong](https://github.com/tanghoong)
