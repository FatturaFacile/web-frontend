/** One server-sent event: its name (`message` when none) and the data lines joined with a line feed. */
export interface SseMessage {
  event: string;
  data: string;
}

export interface SseParseResult {
  messages: SseMessage[];
  /** How many characters of the text were consumed: the part after the last blank line is an incomplete event. */
  consumed: number;
}

/**
 * Parses the complete events of the text received so far on a `text/event-stream` response. Comment lines (`: heartbeat`)
 * and the `retry` and `id` fields are skipped; an event is complete only when its terminating blank line has arrived.
 * Call it with the text not consumed yet and skip `consumed` characters afterwards.
 */
export function parseSse(text: string): SseParseResult {
  const normalized = text.replace(/\r\n/g, '\n');
  const end = normalized.lastIndexOf('\n\n');
  if (end < 0) {
    return { messages: [], consumed: 0 };
  }

  const messages: SseMessage[] = [];
  for (const block of normalized.slice(0, end).split('\n\n')) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':') || line === '') {
        continue;
      }
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') {
        event = value;
      } else if (field === 'data') {
        data.push(value);
      }
    }
    if (data.length > 0) {
      messages.push({ event, data: data.join('\n') });
    }
  }

  return { messages, consumed: end + 2 };
}
