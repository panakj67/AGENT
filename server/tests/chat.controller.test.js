import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentMessages } from '../controllers/chat.controller.js';

test('buildAgentMessages appends latest user message after sanitized history', () => {
  const history = [
    { role: 'assistant', content: 'Previous answer' },
    { role: 'tool', content: 'ignored role' },
    { role: 'user', content: '  previous question  ' },
    { role: 'assistant', content: '' },
  ];

  const latest = { role: 'user', content: 'Current question' };
  const result = buildAgentMessages(history, latest);

  assert.equal(result.length, 3);
  assert.deepEqual(result[0], { role: 'assistant', content: 'Previous answer' });
  assert.deepEqual(result[1], { role: 'user', content: '  previous question  ' });
  assert.deepEqual(result[2], { role: 'user', content: 'Current question' });
});

test('buildAgentMessages returns sanitized history when latest message is invalid', () => {
  const history = [
    { role: 'system', content: 'System context' },
    { role: 'assistant', content: 123 },
    { role: 'random', content: 'ignored' },
  ];

  const result = buildAgentMessages(history, { role: 'assistant', content: 'invalid latest role' });

  assert.deepEqual(result, [
    { role: 'system', content: 'System context' },
    { role: 'assistant', content: '123' },
  ]);
});
