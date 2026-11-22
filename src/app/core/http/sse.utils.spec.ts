import { describe, expect, it } from 'vitest';
import { parseSse } from './sse.utils';

describe('parseSse', () => {
  it('reads complete events and skips comments and the retry field', () => {
    const text = 'retry: 3000\n\nevent: machines\ndata: {"a":1}\n\n: heartbeat\n\nevent: machines\ndata: {"a":2}\n\n';
    const { messages, consumed } = parseSse(text);
    expect(messages).toEqual([
      { event: 'machines', data: '{"a":1}' },
      { event: 'machines', data: '{"a":2}' },
    ]);
    expect(consumed).toBe(text.length);
  });

  it('leaves an incomplete event for the next chunk', () => {
    const first = parseSse('event: machines\ndata: {"a":1}\n\nevent: machines\ndata: {"a"');
    expect(first.messages).toHaveLength(1);
    const rest = 'event: machines\ndata: {"a"';
    expect(first.consumed).toBe('event: machines\ndata: {"a":1}\n\n'.length);
    expect(parseSse(`${rest}:2}\n\n`).messages).toEqual([{ event: 'machines', data: '{"a":2}' }]);
  });

  it('defaults the event name, joins data lines and accepts CRLF', () => {
    expect(parseSse('data: one\r\ndata: two\r\n\r\n').messages).toEqual([{ event: 'message', data: 'one\ntwo' }]);
  });

  it('returns nothing before the first blank line', () => {
    expect(parseSse('event: machines')).toEqual({ messages: [], consumed: 0 });
  });
});
