import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs';

(async () => {
  try {
    // Read the actual prompt file
    const prompt = fs.readFileSync('.ralph/prompts/task-001.md', 'utf-8');

    console.log('Testing SDK with actual task prompt...');
    console.log('Prompt length:', prompt.length);
    console.log('First 500 chars of prompt:');
    console.log(prompt.substring(0, 500));
    console.log('');

    const sdkQuery = query({
      prompt: prompt,
      options: {
        cwd: '/data/jbutler/git/jbutlerdev/ralph',
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
        settingSources: ['project'],
        tools: { type: 'preset', preset: 'claude_code' },
      },
    });

    let finalResult = '';
    let hasSuccess = false;
    let errorMessages = [];

    for await (const message of sdkQuery) {
      console.log('Received message type:', message.type, 'subtype:', message.subtype);

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          finalResult = message.result || '';
          hasSuccess = true;
          console.log('\nSUCCESS! Result length:', finalResult.length);
          console.log('Result preview (first 500 chars):', finalResult.substring(0, 500));
        } else if (message.subtype === 'error_during_execution') {
          console.error('ERROR during execution:', message.errors);
          errorMessages = message.errors || [];
        }
      }
    }

    if (!hasSuccess) {
      console.error('\nNo success message received!');
      if (errorMessages.length > 0) {
        console.error('Errors:', errorMessages);
      }
      process.exit(1);
    }

    console.log('\n=== Test completed successfully ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
