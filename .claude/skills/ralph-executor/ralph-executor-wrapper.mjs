#!/usr/bin/env node
/**
 * Ralph Executor CLI Wrapper
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and run the CLI
await import(join(__dirname, 'dist', 'ralph-executor', 'cli.js'));
