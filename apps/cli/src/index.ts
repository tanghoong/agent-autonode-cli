#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './commands/init';
import { registerRunCommand } from './commands/run';
import { registerValidateCommand } from './commands/validate';
import { registerLogsCommand } from './commands/logs';
import { registerSecretsCommand } from './commands/secrets';
import { registerWebhookCommand } from './commands/webhook';
import { registerScheduleCommand } from './commands/schedule';
import { registerAiCommand } from './commands/ai';

const program = new Command();

program
  .name('autonode')
  .description('Autonode - Open-source CLI automation engine')
  .version('0.1.0');

registerInitCommand(program);
registerRunCommand(program);
registerValidateCommand(program);
registerLogsCommand(program);
registerSecretsCommand(program);
registerWebhookCommand(program);
registerScheduleCommand(program);
registerAiCommand(program);

program.parse(process.argv);
