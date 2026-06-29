import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const EXAMPLE_WORKFLOW = `name: my-first-workflow

# Optional trigger - can be webhook, schedule, or run manually
# trigger:
#   type: schedule.trigger
#   with:
#     cron: "0 9 * * *"

steps:
  - id: fetch_data
    type: http.request
    with:
      method: GET
      url: "https://httpbin.org/json"

  - id: log_result
    type: log
    with:
      message: "Fetched data: {{ steps.fetch_data.body }}"
`;

export function registerInitCommand(program: import('commander').Command): void {
  program
    .command('init')
    .description('Initialize a new Autonode project with an example workflow')
    .option('-n, --name <name>', 'Project name', 'my-workflow')
    .option('-d, --dir <dir>', 'Directory to initialize in', '.')
    .action((options: { name: string; dir: string }) => {
      const workflowsDir = path.resolve(options.dir, 'workflows');
      const workflowFile = path.join(workflowsDir, `${options.name}.yaml`);

      if (!fs.existsSync(workflowsDir)) {
        fs.mkdirSync(workflowsDir, { recursive: true });
      }

      if (fs.existsSync(workflowFile)) {
        console.log(chalk.yellow(`File already exists: ${workflowFile}`));
        return;
      }

      fs.writeFileSync(workflowFile, EXAMPLE_WORKFLOW);
      console.log(chalk.green('✓') + ` Created workflow: ${workflowFile}`);
      console.log('');
      console.log('Run your workflow with:');
      console.log(chalk.cyan(`  autonode run ${workflowFile}`));
    });
}
