import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseWorkflowFile, validateWorkflow, executeWorkflow, createInitialContext } from '@taskpipe/engine';
import { createDefaultRegistry } from '@taskpipe/connectors';
import { TaskPipeStorage } from '@taskpipe/storage';
import { logger, StepResult } from '@taskpipe/shared';

export function registerRunCommand(program: import('commander').Command): void {
  program
    .command('run <workflow>')
    .description('Run a workflow file')
    .option('--dry-run', 'Parse and validate only, do not execute')
    .option('--db <path>', 'Path to database file')
    .action(async (workflowPath: string, options: { dryRun?: boolean; db?: string }) => {
      const spinner = ora('Loading workflow...').start();

      try {
        const filePath = path.resolve(workflowPath);
        const parsed = parseWorkflowFile(filePath);
        const workflow = validateWorkflow(parsed);

        spinner.succeed(`Workflow '${workflow.name}' loaded`);

        if (options.dryRun) {
          console.log(chalk.green('✓ Workflow is valid'));
          return;
        }

        const storage = new TaskPipeStorage(options.db);
        const runRecord = storage.createRun(workflow.name, workflow.trigger?.type ?? 'manual');

        console.log(chalk.dim(`Run ID: ${runRecord.id}`));
        console.log('');

        const context = createInitialContext();
        const connectors = createDefaultRegistry();

        const stepRecords = new Map<string, string>();

        storage.updateRun(runRecord.id, 'running');

        try {
          await executeWorkflow(workflow, context, connectors, {
            onStepStart: async (stepId, stepType, input) => {
              const stepRun = storage.createStepRun(runRecord.id, stepId, stepType, input);
              stepRecords.set(stepId, stepRun.id);
              spinner.start(`Running step: ${chalk.cyan(stepId)}`);
            },
            onStepComplete: async (stepId, result: StepResult) => {
              const stepRunId = stepRecords.get(stepId);
              if (stepRunId) {
                storage.updateStepRun(stepRunId, 'success', result);
              }
              spinner.succeed(`Step ${chalk.cyan(stepId)} completed`);
            },
            onStepError: async (stepId, error) => {
              const stepRunId = stepRecords.get(stepId);
              if (stepRunId) {
                storage.updateStepRun(stepRunId, 'failed', undefined, error.message);
              }
              spinner.fail(`Step ${chalk.cyan(stepId)} failed: ${error.message}`);
            },
          });

          storage.updateRun(runRecord.id, 'success');
          console.log('');
          console.log(chalk.green('✓ Workflow completed successfully'));
        } catch (err) {
          const error = err as Error;
          storage.updateRun(runRecord.id, 'failed', error.message);
          console.log('');
          console.log(chalk.red('✗ Workflow failed: ' + error.message));
          process.exit(1);
        } finally {
          storage.close();
        }
      } catch (err) {
        spinner.fail('Failed to run workflow');
        logger.error((err as Error).message);
        process.exit(1);
      }
    });
}
