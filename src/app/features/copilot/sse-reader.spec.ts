import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import type { CopilotSseFrame } from './copilot.models';
import { readSseStream } from './sse-reader';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<CopilotSseFrame[]> {
  const frames: CopilotSseFrame[] = [];
  for await (const frame of readSseStream(stream as unknown as Parameters<typeof readSseStream>[0])) {
    frames.push(frame);
  }

  return frames;
}

describe('readSseStream', () => {
  it('parses events with JSON payloads', async () => {
    const frames = await collect(streamOf('event: token\ndata: {"text":"Hi"}\n\nevent: message.completed\ndata: {"message_id":"m1","conversation_id":"c1"}\n\n'));

    expect(frames).toEqual([
      { event: 'token', data: { text: 'Hi' } },
      { event: 'message.completed', data: { message_id: 'm1', conversation_id: 'c1' } },
    ]);
  });

  it('reassembles an event split across chunks, even in the middle of a multi-byte character', async () => {
    const bytes = new TextEncoder().encode('event: token\ndata: {"text":"€uro"}\n\n');
    const euro = bytes.indexOf(0xe2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, euro + 1));
        controller.enqueue(bytes.slice(euro + 1));
        controller.close();
      },
    });

    expect(await collect(stream)).toEqual([{ event: 'token', data: { text: '€uro' } }]);
  });

  it('handles CRLF endings, comments and a final block without a blank line', async () => {
    const frames = await collect(streamOf(': keep-alive\r\n\r\nevent: token\r\ndata: {"text":"a"}\r\n\r\nevent: error\r\ndata: {"message":"boom"}'));

    expect(frames).toEqual([
      { event: 'token', data: { text: 'a' } },
      { event: 'error', data: { message: 'boom' } },
    ]);
  });

  it('joins multi-line data and keeps non-JSON data as text', async () => {
    const frames = await collect(streamOf('event: note\ndata: line1\ndata: line2\n\n'));

    expect(frames).toEqual([{ event: 'note', data: 'line1\nline2' }]);
  });

  it('defaults the event name to message', async () => {
    expect(await collect(streamOf('data: {"a":1}\n\n'))).toEqual([{ event: 'message', data: { a: 1 } }]);
  });
});
