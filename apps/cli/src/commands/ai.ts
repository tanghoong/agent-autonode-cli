import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAICompatibleProvider } from '@autonode/agent';
import { loadSecrets } from '../utils/secrets';

const SYSTEM_PROMPT = `You are an expert at creating Autonode workflow YAML files.
Autonode is a CLI automation engine that runs workflows defined in YAML.

Workflow YAML format:
\`\`\`yaml
name: workflow-name

trigger:  # optional
  type: schedule.trigger  # or webhook.trigger
  with:
    cron: "0 9 * * *"  # for schedule

steps:
  - id: step_id
    type: connector_type
    with:
      # connector-specific config

  - id: another_step
    type: http.request
    retry:
      attempts: 3
      delay: 5000
    timeout: 30000
    with:
      method: GET
      url: "https://api.example.com"
\`\`\`

Available connectors:
- http.request: { method, url, headers, body, query }
- log: { message, level }
- condition: { if, then, else }
- transform.json: { input, template }
- agent.prompt: { model, prompt, systemPrompt, output: { format: text|json } }
- file.read: { path }
- file.write: { path, content, append }

Variable interpolation: {{ steps.step_id.body }}, {{ trigger.body.field }}, {{ env.VAR }}, {{ secrets.KEY }}

Respond with ONLY the YAML content, no explanation or markdown fences.`;

export function registerAiCommand(program: import('commander').Command): void {
  program
    .command('ai <prompt...>')
    .description('Generate a workflow from natural language')
    .option('-o, --output <file>', 'Save generated workflow to file')
    .option('--model <model>', 'AI model to use', 'gpt-4.1-mini')
    .action(async (promptParts: string[], options: { output?: string; model: string }) => {
      const userPrompt = promptParts.join(' ');
      const secrets = loadSecrets();

      const apiKey = secrets['OPENAI_API_KEY'] ?? process.env['OPENAI_API_KEY'];
      if (!apiKey) {
        console.log(chalk.red('OPENAI_API_KEY is required. Set it with:'));
        console.log(chalk.cyan('  autonode secrets set OPENAI_API_KEY <your-key>'));
        process.exit(1);
      }

      const baseUrl = process.env['OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1';
      const provider = new OpenAICompatibleProvider(apiKey, baseUrl);

      const spinner = ora('Generating workflow...').start();

      try {
        const result = await provider.chat({
          model: options.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        });

        spinner.stop();

        const yamlContent = result.content.trim();
        console.log('');
        console.log(chalk.bold('Generated workflow:'));
        console.log('');
        console.log(yamlContent);

        if (options.output) {
          const outputPath = path.resolve(options.output);
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(outputPath, yamlContent);
          console.log('');
          console.log(chalk.green('✓') + ` Saved to: ${outputPath}`);
        }
      } catch (err) {
        spinner.fail('Failed to generate workflow');
        console.log(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}
