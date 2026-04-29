import chalk from 'chalk';
import { TaskPipeStorage } from '@taskpipe/storage';

export function registerLogsCommand(program: import('commander').Command): void {
  program
    .command('logs')
    .description('View execution logs')
    .option('--run <run_id>', 'View logs for a specific run')
    .option('--db <path>', 'Path to database file')
    .option('-n, --limit <number>', 'Number of runs to show', '20')
    .action((options: { run?: string; db?: string; limit: string }) => {
      const storage = new TaskPipeStorage(options.db);
      const limit = parseInt(options.limit, 10);

      try {
        if (options.run) {
          const run = storage.getRun(options.run);
          if (!run) {
            console.log(chalk.red(`Run '${options.run}' not found`));
            process.exit(1);
          }

          const statusColor = run.status === 'success' ? chalk.green : run.status === 'failed' ? chalk.red : chalk.yellow;

          console.log(chalk.bold(`Run: ${run.id}`));
          console.log(`  Workflow: ${run.workflowName}`);
          console.log(`  Status:   ${statusColor(run.status)}`);
          console.log(`  Trigger:  ${run.triggerType}`);
          console.log(`  Started:  ${run.startedAt}`);
          if (run.completedAt) console.log(`  Ended:    ${run.completedAt}`);
          if (run.error) console.log(`  Error:    ${chalk.red(run.error)}`);
          console.log('');
          console.log(chalk.bold('Steps:'));

          const steps = storage.listStepRuns(options.run);
          for (const step of steps) {
            const sc = step.status === 'success' ? chalk.green : step.status === 'failed' ? chalk.red : chalk.yellow;
            console.log(`  ${sc('●')} ${step.stepId} (${step.stepType}) - ${sc(step.status)}`);
            if (step.error) console.log(`    Error: ${chalk.red(step.error)}`);
          }
        } else {
          const runs = storage.listRuns(limit);
          if (runs.length === 0) {
            console.log('No runs found.');
            return;
          }

          console.log(chalk.bold('Recent runs:'));
          console.log('');
          for (const run of runs) {
            const statusColor = run.status === 'success' ? chalk.green : run.status === 'failed' ? chalk.red : chalk.yellow;
            console.log(`  ${statusColor('●')} ${run.id} - ${run.workflowName} - ${statusColor(run.status)}`);
            console.log(`    ${chalk.dim(run.startedAt)}`);
          }
        }
      } finally {
        storage.close();
      }
    });
}
