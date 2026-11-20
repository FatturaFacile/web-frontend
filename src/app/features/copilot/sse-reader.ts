import type { CopilotSseFrame } from './copilot.models';

/**
 * Reads a `text/event-stream` body and yields one frame per event block. Handles chunk boundaries inside a
 * block, CRLF line endings, comment lines, multi-line `data:` fields and JSON payloads.
 */
export async function* readSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<CopilotSseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
      }
      if (done) {
        buffer += decoder.decode();
      }
      buffer = buffer.replace(/\r\n?/g, '\n');

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const frame = parseBlock(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
        if (frame) {
          yield frame;
        }
        separator = buffer.indexOf('\n\n');
      }

      if (done) {
        const rest = parseBlock(buffer);
        if (rest) {
          yield rest;
        }

        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): CopilotSseFrame | null {
  let event = 'message';
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      data.push(value);
    }
  }

  if (data.length === 0) {
    return null;
  }

  const raw = data.join('\n');
  try {
    return { event, data: JSON.parse(raw) as unknown };
  } catch {
    return { event, data: raw };
  }
}
