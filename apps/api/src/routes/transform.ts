import { Hono } from 'hono';
import { TransformService } from '../services/transform.service';
import logger, { serializeError } from '../utils/logger';

const t = new Hono();
const transformService = new TransformService();

t.get('/*', async (c) => {
  const path = c.req.path;
  const userAgent = c.req.header('User-Agent') ?? '';
  const acceptHeader = c.req.header('Accept');

  try {
    const skipCache = c.req.query('skip-cache') === '1';
    const result = await transformService.transform({
      path,
      userAgent,
      acceptHeader,
      context: c,
      skipCache,
    });

    // Set response headers
    Object.entries(result.headers).forEach(([key, value]) => {
      c.header(key, value);
    });

    // Determine content type if not set in headers
    if (!result.contentType) {
      // Extract file extension from path
      const ext = path.split('.').pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        avif: 'image/avif',
        gif: 'image/gif',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        flac: 'audio/flac',
        aac: 'audio/aac',
        m4a: 'audio/mp4',
      };
      const contentType =
        contentTypeMap[ext || ''] || 'application/octet-stream';
      c.header('Content-Type', contentType);
    } else {
      c.header('Content-Type', result.contentType);
    }

    // Check if this is an error response
    if (
      result.contentType === 'text/plain' &&
      result.buffer.toString().includes('failed')
    ) {
      const errorMessage = result.buffer.toString();
      if (errorMessage.includes('File not found')) {
        return c.text(errorMessage, 404);
      }
      return c.text(errorMessage, 500);
    }

    // Support HTTP Range requests for video seeking
    c.header('Accept-Ranges', 'bytes');

    const range = c.req.header('Range');
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : result.buffer.length - 1;
        const chunk = result.buffer.subarray(start, end + 1);
        c.header('Content-Range', `bytes ${start}-${end}/${result.buffer.length}`);
        c.header('Content-Length', chunk.length.toString());
        return c.body(new Uint8Array(chunk), 206);
      }
    }

    return c.body(new Uint8Array(result.buffer));
  } catch (error) {
    logger.error({ error: serializeError(error), path }, 'Transform route error');
    return c.text('Internal server error', 500);
  }
});

export default t;
