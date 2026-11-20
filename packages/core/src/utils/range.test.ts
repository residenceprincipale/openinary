import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRange } from "./range";

test("parseRange handles closed, open and suffix ranges", () => {
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=900-", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  // Clamped to the file, and a start past the end is unsatisfiable.
  assert.deepEqual(parseRange("bytes=990-2000", 1000), { start: 990, end: 999 });
  assert.equal(parseRange("bytes=1000-", 1000), null);
  assert.equal(parseRange("bytes=50-10", 1000), null);
  assert.equal(parseRange("items=0-1", 1000), null);
});
