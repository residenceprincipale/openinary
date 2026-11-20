import { test } from "node:test";
import assert from "node:assert/strict";

import { isTransformSegment, parseParams } from "./grammar";
import {
  AUDIO_FORMATS,
  IMAGE_FORMATS,
  VIDEO_FORMATS,
  determineOutputFormat,
  contentTypeForFormat,
} from "./media-types";

// The f_ parameter is the trust boundary: every value it lets through must be a
// format some encoder can actually produce, otherwise we serve bytes of one
// format under the content-type of another.

test("f_ accepts only encodable output formats", () => {
  for (const f of [
    "webp", "jpg", "jpeg", "png", "avif", "gif", "mp4", "webm", "mov",
    "mp3", "wav", "ogg", "flac", "aac", "m4a", "auto",
  ]) {
    assert.ok(isTransformSegment(`f_${f}`), `${f} should be accepted`);
  }
});

test("f_ rejects formats no encoder produces", () => {
  // psd is an accepted upload format but never an output; the rest were never
  // wired to any encoder and silently fell back to png/mp4.
  for (const f of ["psd", "avi", "pdf", "tiff"]) {
    assert.ok(!isTransformSegment(`f_${f}`), `${f} should be rejected`);
  }
});

test("every f_ value maps to a real image, video or audio output format", () => {
  const encodable = new Set([
    ...IMAGE_FORMATS,
    ...VIDEO_FORMATS,
    ...AUDIO_FORMATS,
    "auto",
  ]);
  for (const f of [
    "webp", "jpg", "jpeg", "png", "avif", "gif", "mp4", "webm", "mov",
    "mp3", "wav", "ogg", "flac", "aac", "m4a", "auto",
  ]) {
    const { format } = parseParams(`/t/f_${f}/x.jpg`);
    assert.ok(encodable.has(format), `${f} parsed to unencodable ${format}`);
  }
});

test("video thumbnails resolve to an image format, video transforms to a video one", () => {
  assert.deepEqual(determineOutputFormat("mp4", "webp"), {
    format: "webp",
    isImageOutput: true,
    isThumbnail: true,
  });
  assert.equal(determineOutputFormat("mp4", "webm").format, "webm");
  // psd is no longer an image output, so it can't produce a bogus image/psd
  assert.equal(determineOutputFormat("mp4", "psd").isImageOutput, false);
});

test("a video asked for an audio format keeps that format", () => {
  assert.deepEqual(determineOutputFormat("mp4", "mp3"), {
    format: "mp3",
    isImageOutput: false,
    isThumbnail: false,
  });
  // An audio source with no format keeps its own container, not mp4.
  assert.equal(determineOutputFormat("wav", undefined).format, "wav");
});

test("contentTypeForFormat serves real types; unknown is octet-stream, never video/mp4", () => {
  assert.equal(contentTypeForFormat("jpeg"), "image/jpeg");
  assert.equal(contentTypeForFormat("mp4"), "video/mp4");
  assert.equal(contentTypeForFormat("glb"), "model/gltf-binary");
  assert.equal(contentTypeForFormat("wav"), "audio/wav");
  assert.equal(contentTypeForFormat("xyz"), "application/octet-stream");
});
