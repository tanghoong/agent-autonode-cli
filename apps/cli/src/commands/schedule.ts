import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { parseWorkflowFile, validateWorkflow, executeWorkflow, createInitialContext } from '@taskpipe/engine';
import { createDefaultRegistry } from '@taskpipe/connectors';
import { TaskPipeStorage } from '@taskpipe/storage';
import { logger } from '@taskpipe/shared';

export function registerScheduleCommand(program: import('commander').Command): void {
  const schedule = program.command('schedule').description('Schedule runner commands');

  schedule
    .command('start')
    .description('Start the schedule runner')
    .option('-d, --dir <dir>', 'Directory to scan for workflow files', './workflows')
    .option('--db <path>', 'Path to database file')
    .action(async (options: { dir: string; db?: string }) => {
      const cron = await import('node-cron');
      const workflowsDir = path.resolve(options.dir);

      if (!fs.existsSync(workflowsDir)) {
        console.log(chalk.red(`Workflows directory not found: ${workflowsDir}`));
        process.exit(1);
      }

      const storage = new TaskPipeStorage(options.db);
      const connectors = createDefaultRegistry();
      const scheduledTasks: ReturnType<typeof cron.schedule>[] = [];

      console.log(chalk.blue('Scanning for scheduled workflows in:'), workflowsDir);

      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of files) {
        const filePath = path.join(workflowsDir, file);
        try {
          const workflow = validateWorkflow(parseWorkflowFile(filePath));

          if (workflow.trigger?.type !== 'schedule.trigger') continue;

          const cronExpr = workflow.trigger.with?.['cron'] as string | undefined;
          if (!cronExpr) {
            logger.warn(`Workflow '${workflow.name}' has schedule.trigger but no cron expression`);
            continue;
          }

          if (!cron.validate(cronExpr)) {
            logger.warn(`Workflow '${workflow.name}' has invalid cron expression: ${cronExpr}`);
            continue;
          }

          console.log(chalk.green('✓') + ` Scheduled '${workflow.name}' with cron: ${cronExpr}`);

          const task = cron.schedule(cronExpr, async () => {
            logger.info(`Running scheduled workflow: ${workflow.name}`);
            const run = storage.createRun(workflow.name, 'schedule.trigger');
            storage.updateRun(run.id, 'running');

            try {
              const context = createInitialContext();
              await executeWorkflow(workflow, context, connectors);
              storage.updateRun(run.id, 'success');
              logger.success(`Scheduled workflow '${workflow.name}' completed`);
            } catch (err) {
              storage.updateRun(run.id, 'failed', (err as Error).message);
              logger.error(`Scheduled workflow '${workflow.name}' failed: ${(err as Error).message}`);
            }
          });

          scheduledTasks.push(task);
        } catch (err) {
          logger.warn(`Skipping '${file}': ${(err as Error).message}`);
        }
      }

      if (scheduledTasks.length === 0) {
        console.log(chalk.yellow('No scheduled workflows found.'));
        storage.close();
        return;
      }

      console.log(chalk.green(`\n${scheduledTasks.length} workflow(s) scheduled. Press Ctrl+C to stop.`));

      process.on('SIGTERM', () => {
        scheduledTasks.forEach(t => t.stop());
        storage.close();
        process.exit(0);
      });
      process.on('SIGINT', () => {
        scheduledTasks.forEach(t => t.stop());
        storage.close();
        process.exit(0);
      });
    });
}
