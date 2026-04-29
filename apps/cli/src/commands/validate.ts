import * as path from 'path';
import chalk from 'chalk';
import { parseWorkflowFile, validateWorkflow } from '@taskpipe/engine';

export function registerValidateCommand(program: import('commander').Command): void {
  program
    .command('validate <workflow>')
    .description('Validate a workflow file')
    .action((workflowPath: string) => {
      try {
        const filePath = path.resolve(workflowPath);
        const parsed = parseWorkflowFile(filePath);
        const workflow = validateWorkflow(parsed);

        console.log(chalk.green('✓') + ` Workflow '${workflow.name}' is valid`);
        console.log(`  Steps: ${workflow.steps.length}`);
        console.log(`  Trigger: ${workflow.trigger?.type ?? 'none (manual)'}`);
      } catch (err) {
        console.log(chalk.red('✗ Validation failed: ' + (err as Error).message));
        process.exit(1);
      }
    });
}
