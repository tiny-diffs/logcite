import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LineIndex } from "../src/lineindex.ts";
import { expandFile, expandText } from "../src/expand.ts";
import { compressStream } from "../src/stream.ts";

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new Response(text).body!;
}

async function tmpLog(text: string): Promise<string> {
  const path = join(tmpdir(), `logcite-expand-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
  await Bun.write(path, text);
  return path;
}

// A log where the content of each line encodes its own line number, so a wrong
// seek/offset shows up immediately as a mismatched line.
function numberedLog(n: number): string {
  return Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
}

describe("LineIndex", () => {
  test("checkpoints line 1 and every stride", () => {
    const idx = new LineIndex(100);
    for (let ln = 1; ln <= 250; ln++) idx.maybeAdd(ln, ln * 10);
    expect(idx.totalLines).toBe(250);
    // checkpoints at lines 1, 101, 201
    expect(idx.checkpointCount).toBe(3);
    expect(idx.nearestBefore(150)).toEqual({ line: 101, offset: 1010 });
    expect(idx.nearestBefore(1)).toEqual({ line: 1, offset: 10 });
    expect(idx.nearestBefore(99999)).toEqual({ line: 201, offset: 2010 });
  });

  test("serialize / parse round-trips", () => {
    const idx = new LineIndex(50);
    for (let ln = 1; ln <= 120; ln++) idx.maybeAdd(ln, ln * 7);
    const back = LineIndex.parse(idx.serialize());
    expect(back.stride).toBe(50);
    expect(back.totalLines).toBe(120);
    expect(back.nearestBefore(75)).toEqual(idx.nearestBefore(75));
  });

  test("rejects an unknown index version", () => {
    expect(() => LineIndex.parse(JSON.stringify({ v: 2, stride: 1, total: 0, checkpoints: [] }))).toThrow();
  });
});

describe("expandText", () => {
  test("returns a symmetric window around the target", () => {
    const r = expandText(numberedLog(100), 50, 3);
    expect(r.from).toBe(47);
    expect(r.to).toBe(53);
    expect(r.lines.map((l) => l.text)).toEqual([
      "line 47", "line 48", "line 49", "line 50", "line 51", "line 52", "line 53",
    ]);
  });

  test("clamps at the start and end of the file", () => {
    const text = numberedLog(10);
    expect(expandText(text, 1, 5).from).toBe(1);
    expect(expandText(text, 10, 5).to).toBe(10);
    expect(expandText(text, 10, 5).lines.at(-1)!.text).toBe("line 10");
  });
});

describe("expandFile", () => {
  test("with an index, seeks to and returns the exact cited window", async () => {
    const path = await tmpLog(numberedLog(5000));
    const idx = new LineIndex(100);
    await compressStream(streamOf(numberedLog(5000)), {}, {}, idx);

    const r = await expandFile(path, 3120, 2, idx);
    expect(r.from).toBe(3118);
    expect(r.to).toBe(3122);
    expect(r.lines.map((l) => l.text)).toEqual([
      "line 3118", "line 3119", "line 3120", "line 3121", "line 3122",
    ]);
    // every returned line number matches its own content -> the seek was exact
    for (const l of r.lines) expect(l.text).toBe(`line ${l.line}`);
  });

  test("agrees with the no-index fallback (scan from top)", async () => {
    const path = await tmpLog(numberedLog(2000));
    const idx = new LineIndex(250);
    await compressStream(streamOf(numberedLog(2000)), {}, {}, idx);

    const withIdx = await expandFile(path, 1500, 4, idx);
    const noIdx = await expandFile(path, 1500, 4);
    expect(withIdx).toEqual(noIdx);
  });

  test("offsets stay exact with multi-byte characters", async () => {
    const text = ["café 1", "café 2", "café 3", "café 4", "café 5"].join("\n") + "\n";
    const path = await tmpLog(text);
    const idx = new LineIndex(2);
    await compressStream(streamOf(text), {}, {}, idx);
    const r = await expandFile(path, 4, 1, idx);
    expect(r.lines.map((l) => l.text)).toEqual(["café 3", "café 4", "café 5"]);
  });

  test("clamps at the end of the file", async () => {
    const path = await tmpLog(numberedLog(30));
    const r = await expandFile(path, 30, 10);
    expect(r.to).toBe(30);
    expect(r.lines.at(-1)!.text).toBe("line 30");
  });

  test("rejects a non-positive line", async () => {
    const path = await tmpLog(numberedLog(10));
    await expect(expandFile(path, 0)).rejects.toThrow();
  });
});
