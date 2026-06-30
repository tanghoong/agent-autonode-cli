# Autonode

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

**Autonode** is a developer-friendly automation engine that lets you orchestrate multi-step workflows using simple YAML files. Each workflow is a sequence of *steps*, where each step calls a *connector* — a typed, reusable action such as making an HTTP request, reading a file, calling an AI model, or evaluating a condition.

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
| **Workflow Engine** | YAML parsing, `{{ }}` template interpolation, sequential + [parallel](docs/parallel.md) execution, [`forEach`](docs/foreach.md) loops, per-step retry, timeout & `condition` |
| **Triggers** | `schedule.trigger` (cron), `webhook.trigger` (HTTP endpoint), manual `run` |
| **Connectors (7)** | `http.request`, `log`, `condition`, `transform.json`, `agent.prompt`, `file.read`, `file.write` |
| **LLM / AI** | OpenAI-compatible API, text & JSON output modes, AI workflow generation from natural language |
| **CLI Commands (9)** | `init`, `run`, `validate`, `logs`, `secrets`, `webhook`, `schedule`, `ai`, `plugins` |
| **Configuration** | `autonode.config.json` (project config, discovered by walking up from the cwd) — see [docs/configuration.md](docs/configuration.md) |
| **Plugins** | Custom connectors loaded from npm packages or local modules via `autonode.config.json` — see [docs/plugins.md](docs/plugins.md) |
| **Storage** | SQLite persistence for run history and step-level audit trail |
| **Secrets** | File-based secret store (`~/.autonode/secrets.json`), accessible in templates via `{{ secrets.KEY }}` |
| **DevOps** | Dockerfile, docker-compose, GitHub Actions CI |

---

## Architecture

Autonode is a **pnpm monorepo** composed of focused packages:

```
autonode/
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
autonode run workflow.yaml
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
npm install -g @autonode/cli
# or
pnpm add -g @autonode/cli
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
autonode init

# 2. Set an API key (for AI steps)
autonode secrets set OPENAI_API_KEY sk-...

# 3. Validate your workflow
autonode validate workflows/my-workflow.yaml

# 4. Run it
autonode run workflows/my-workflow.yaml

# 5. Inspect the execution log
autonode logs
```

---

## CLI Reference

| Command | Description |
|---|---|
| `autonode init [--name <n>] [--dir <d>]` | Scaffold a new project with an example workflow |
| `autonode run <workflow> [--dry-run] [--db <path>]` | Execute a workflow file |
| `autonode validate <workflow>` | Validate YAML syntax and schema |
| `autonode logs [--run <id>]` | List all runs or view a specific run's step details |
| `autonode secrets set <key> <value>` | Store a secret |
| `autonode secrets list` | List stored secret keys |
| `autonode secrets remove <key>` | Delete a secret |
| `autonode webhook start [--port <p>]` | Start an HTTP webhook server |
| `autonode schedule start [--dir <d>]` | Start the cron scheduler for all workflows in a directory |
| `autonode ai "<prompt>" [--output <file>] [--model <m>]` | Generate a workflow YAML from natural language |

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

Ready-to-use examples are included in the `examples/` directory:

| File | Trigger | Description |
|---|---|---|
| `daily-ai-summary.yaml` | Cron (9 AM) | Fetch data → AI summary → POST report |
| `morning-briefing.yaml` | Cron (8 AM, Mon–Fri) | Gather sources **in parallel** → JSONPath → AI brief → post to chat |
| `batch-enrichment.yaml` | Manual | Fetch a list → enrich each item via **`forEach`** (bounded concurrency) → summarise |
| `webhook-feedback.yaml` | Webhook | Classify incoming customer feedback with LLM |
| `github-issue-triage.yaml` | Webhook | Auto-label and prioritise GitHub issues |
| `local-markdown-summarizer.yaml` | Manual | Read a Markdown file → summarise with AI → write output |
| `api-health-checker.yaml` | Cron | Ping multiple API endpoints and log health status |
| `form-submission-router.yaml` | Webhook | Route form submissions to different handlers by type |

Run any example:

```bash
autonode run examples/daily-ai-summary.yaml
```

---

## Docker

### Build and run with Docker

```bash
docker build -t autonode .
docker run --rm autonode validate workflows/my-workflow.yaml
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
│   └── cli/                   # @autonode/cli — CLI entry point
│       └── src/commands/      # init, run, validate, logs, secrets,
│                              #   webhook, schedule, ai
├── packages/
│   ├── shared/                # @autonode/shared — types & schemas (Zod)
│   ├── engine/                # @autonode/engine — parser, executor, interpolation
│   ├── connectors/            # @autonode/connectors — 7 built-in connectors
│   ├── storage/               # @autonode/storage — SQLite run/step persistence
│   └── agent/                 # @autonode/agent — LLM client
├── examples/                  # example workflow YAML files
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

### ✅ v0.2 — Quality & Security (current)

- [x] Unit tests for engine components (interpolation, executor, parser, validator)
- [x] Unit tests for connectors (condition, log, transform.json, http.request, file.read, file.write)
- [x] ESLint + Prettier configuration
- [x] Secrets encryption (AES-256-GCM via Node.js `crypto` — no third-party libs)
- [x] Safe expression evaluator for `condition` connector (no `new Function()`)
- [x] HTTP request timeout with `AbortController` (default 30 s)
- [x] User-friendly HTTP network error messages
- [x] Path traversal protection in `file.read` / `file.write`
- [x] Secrets injected into workflow execution context (run, schedule, webhook)
- [x] Integration tests for end-to-end scenarios

### ✅ v0.3 — Extensibility

- [x] Plugin / custom connector system (load connectors from npm packages or local modules)
- [x] Step `condition` field evaluation (skip steps dynamically)
- [x] Parallel step execution groups ([docs](docs/parallel.md))
- [x] `transform.json` with JSONPath expressions

v0.3 is complete. See [`docs/v0.3-scope.md`](docs/v0.3-scope.md) for the scope and plan.

### 🌐 v0.4 — Integrations & UX

- [x] `forEach` loops — run a sub-pipeline per item of a runtime array, with bounded concurrency ([docs](docs/foreach.md))
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
