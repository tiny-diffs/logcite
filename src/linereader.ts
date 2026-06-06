/**
 * Streaming line reader.
 *
 * Yields physical log lines from a byte stream without ever holding the whole
 * input in memory. Line numbers count every physical line (blank ones included)
 * so citations match the source exactly, like the in-memory parser. Each line
 * also carries the byte offset where it begins, so a {@link ./lineindex.ts
 * LineIndex} can be built in the same pass and a citation later seeked to.
 *
 * Honors `maxBytes` / `maxLines` by stopping (and cancelling the stream) early.
 * A final line truncated by `maxBytes` is dropped so parsing stays clean.
 */
export interface ReadLimits {
  maxBytes?: number;
  maxLines?: number;
}

export interface RawLine {
  raw: string;
  /** 1-based physical line number. */
  lineNo: number;
  /** Byte offset where this line begins in the source. */
  byteOffset: number;
}

export async function* streamLines(
  stream: ReadableStream<Uint8Array>,
  limits: ReadLimits = {},
): AsyncGenerator<RawLine> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let offset = 0; // byte offset of the next line's start (incl. past newlines)
  let lineNo = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        lineNo++;
        if (limits.maxLines !== undefined && lineNo > limits.maxLines) return;
        const start = offset;
        const cost = Buffer.byteLength(raw, "utf8") + 1; // +1 for the newline
        if (limits.maxBytes !== undefined && start + cost > limits.maxBytes) return;
        offset = start + cost;
        yield { raw, lineNo, byteOffset: start };
      }
    }

    // Flush a trailing line with no newline.
    buf += decoder.decode();
    if (buf.length > 0) {
      lineNo++;
      if (limits.maxLines !== undefined && lineNo > limits.maxLines) return;
      const cost = Buffer.byteLength(buf, "utf8") + 1;
      if (limits.maxBytes === undefined || offset + cost <= limits.maxBytes) {
        yield { raw: buf, lineNo, byteOffset: offset };
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
