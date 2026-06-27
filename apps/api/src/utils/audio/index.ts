import { mkdtemp, readFile, unlink, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { execFile } from 'node:child_process';
import ffmpeg from 'fluent-ffmpeg';

const AUDIO_CODECS: Record<string, string> = {
  mp3: 'libmp3lame',
  wav: 'pcm_s16le',
  ogg: 'libvorbis',
  flac: 'flac',
  aac: 'aac',
  m4a: 'aac',
};

async function runFfmpeg(
  cmd: ffmpeg.FfmpegCommand,
  outputPath: string,
  tmpDir: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 120000;
    const timeoutId = setTimeout(() => {
      cmd.kill('SIGKILL');
      reject(new Error('Audio processing timeout'));
    }, TIMEOUT_MS);

    cmd
      .on('end', async () => {
        clearTimeout(timeoutId);
        try {
          const buffer = await readFile(outputPath);
          await unlink(outputPath).catch(() => {});
          await rmdir(tmpDir).catch(() => {});
          resolve(buffer);
        } catch (e) {
          reject(e);
        }
      })
      .on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`Audio processing failed: ${err.message}`));
      })
      .run();
  });
}

export async function transformAudio(
  inputPath: string,
  params: Record<string, string>,
): Promise<Buffer> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'audio-'));
  const sourceExt = inputPath.split('.').pop()?.toLowerCase() || '';
  const format = params.format || sourceExt || 'mp3';
  const outputPath = join(tmpDir, `${randomUUID()}.${format}`);
  const codec = AUDIO_CODECS[format] || 'copy';

  const hasAudio = await new Promise<boolean>(resolve => {
    ffmpeg.ffprobe(inputPath, (_, metadata) => {
      resolve(metadata?.streams?.some(s => s.codec_type === 'audio') ?? false);
    });
  });

  // ponytail: video without audio → generate silence instead of error
  if (!hasAudio) {
    // fluent-ffmpeg rejects lavfi (it's a device, not a demuxer), so call ffmpeg directly
    const acodec = codec === 'copy' ? 'libmp3lame' : codec;
    await new Promise<void>((resolve, reject) => {
      execFile('ffmpeg', [
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', '1', '-acodec', acodec,
        '-threads', '4', '-y', outputPath,
      ], { timeout: 120000 }, (err) => {
        if (err) reject(new Error(`Silent audio generation failed: ${err.message}`));
        else resolve();
      });
    });
    const buffer = await readFile(outputPath);
    await unlink(outputPath).catch(() => {});
    await rmdir(tmpDir).catch(() => {});
    return buffer;
  }

  let cmd = ffmpeg(inputPath).noVideo().output(outputPath).addOption('-threads', '4');

  if (params.startOffset) {
    cmd = cmd.addOption('-ss', params.startOffset);
  }
  if (params.endOffset) {
    cmd = cmd.addOption('-to', params.endOffset);
  }

  if (params.quality) {
    const bitrate = parseInt(params.quality, 10);
    if (!isNaN(bitrate)) {
      cmd = cmd.audioBitrate(Math.min(bitrate, 320));
    }
  }

  if (params.sampleRate) {
    cmd = cmd.addOption('-ar', params.sampleRate);
  }

  if (params.volume) {
    cmd = cmd.addOption('-filter:a', `volume=${Math.min(parseInt(params.volume, 10), 100) / 100}`);
  }

  if (params.channels) {
    const ch = params.channels === 'mono' ? '1' : params.channels === 'stereo' ? '2' : params.channels;
    cmd = cmd.addOption('-ac', ch);
  }

  if (codec !== 'copy') {
    cmd = cmd.audioCodec(codec);
  }

  return runFfmpeg(cmd, outputPath, tmpDir);
}
