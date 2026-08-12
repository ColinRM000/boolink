#!/usr/bin/env node
import { runCli } from './runner.js';
import { runInteractiveShop, shouldLaunchInteractive } from './tui.js';

const args = process.argv.slice(2);

if (shouldLaunchInteractive(args, process.stdin.isTTY, process.stdout.isTTY)) {
  const command = await runInteractiveShop();
  process.exitCode = command ? await runCli(command) : 0;
} else {
  process.exitCode = await runCli(args);
}
