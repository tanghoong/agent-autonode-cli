import * as path from 'path';
import chalk from 'chalk';
import { AutonodeStorage } from '@autonode/storage';
import { parseWorkflowFile, validateWorkflow, executeWorkflow, createInitialContext } from '@autonode/engine';
import { loadSecrets } from '../utils/secrets';
import { buildRegistry } from '../utils/registry';

const WORKFLOWS_BASE_DIR = path.resolve(process.cwd(), 'workflows');

export function registerWebhookCommand(program: import('commander').Command): void {
  const webhook = program.command('webhook').description('Webhook server commands');

  webhook
    .command('start')
    .description('Start the webhook server')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('--db <path>', 'Path to database file')
    .option('--no-plugins', 'Disable loading connectors from plugins')
    .action(async (options: { port: string; db?: string; plugins?: boolean }) => {
      const express = await import('express');
      const app = express.default();
      const port = parseInt(options.port, 10);

      app.use(express.default.json());
      app.use(express.default.urlencoded({ extended: true }));

      const storage = new AutonodeStorage(options.db);
      const connectors = await buildRegistry({ plugins: options.plugins });

      // Health check
      app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'autonode-webhook' });
      });

      // Generic webhook endpoint - POST /<workflow-path>
      app.post('/webhook/:workflowId', async (req, res) => {
        const { workflowId } = req.params;
        const body = req.body as Record<string, unknown>;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers[k] = v;
        }

        storage.saveWebhookEvent(`/webhook/${workflowId}`, req.method, headers, body);

        res.json({ status: 'accepted', workflowId });
      });

      // Workflow execution endpoint - workflowFile is restricted to the workflows directory
      app.post('/run/:workflowFile', async (req, res) => {
        const { workflowFile } = req.params;

        // Prevent path traversal: resolve to an absolute path and confirm it stays within the base dir
        const safeWorkflowPath = path.resolve(WORKFLOWS_BASE_DIR, workflowFile);
        if (!safeWorkflowPath.startsWith(WORKFLOWS_BASE_DIR + path.sep) && safeWorkflowPath !== WORKFLOWS_BASE_DIR) {
          res.status(400).json({ error: 'Invalid workflow path' });
          return;
        }

        const body = req.body as Record<string, unknown>;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers[k] = v;
        }
        const query: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.query)) {
          if (typeof v === 'string') query[k] = v;
        }

        try {
          const workflow = validateWorkflow(parseWorkflowFile(safeWorkflowPath));
          const run = storage.createRun(workflow.name, 'webhook.trigger');
          storage.updateRun(run.id, 'running');

          const context = createInitialContext({ body, headers, query }, loadSecrets());

          // Run async
          executeWorkflow(workflow, context, connectors)
            .then(() => storage.updateRun(run.id, 'success'))
            .catch(err => storage.updateRun(run.id, 'failed', (err as Error).message));

          res.json({ status: 'accepted', runId: run.id });
        } catch (err) {
          res.status(400).json({ error: (err as Error).message });
        }
      });

      app.listen(port, () => {
        console.log(chalk.green('✓') + ` Webhook server started on port ${port}`);
        console.log(chalk.dim(`Health check: http://localhost:${port}/health`));
        console.log(chalk.dim(`Webhook endpoint: http://localhost:${port}/webhook/:id`));
        console.log(chalk.dim(`Run endpoint: POST http://localhost:${port}/run/:workflowFile`));
      });

      // Graceful shutdown
      process.on('SIGTERM', () => {
        storage.close();
        process.exit(0);
      });
      process.on('SIGINT', () => {
        storage.close();
        process.exit(0);
      });
    });
}
