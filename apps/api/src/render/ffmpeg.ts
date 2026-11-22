import { spawn } from 'node:child_process';

/** Output frame sizes (blueprint §3.1). */
export const FRAME = {
  PORTRAIT_9_16: { width: 1080, height: 1920 },
  LANDSCAPE_16_9: { width: 1920, height: 1080 },
} as const;

export const FPS = 30;
export const RENDERER_VERSION = 'ffmpeg-kenburns-v1';

export interface RenderInput {
  /** Local file: a photo (image) or a provider clip (video). */
  path: string;
  kind: 'image' | 'video';
  seconds: number;
}

export interface RenderAudio {
  /** Voice-over (MP3), or null. */
  voicePath: string | null;
  /** Background music (MP3), or null. Mixed under the voice at a low level. */
  musicPath: string | null;
}

const MUSIC_LEVEL = 0.15;

/**
 * Builds the FFmpeg argument list for one format. Pure: no I/O, so the same input always gives
 * the same arguments. Photos get a slow zoom (Ken Burns). Provider clips are trimmed or padded to
 * their scene length. All scenes are concatenated; audio is voice, music, or a silent track.
 */
export function buildRenderArgs(
  format: keyof typeof FRAME,
  inputs: RenderInput[],
  audio: RenderAudio,
  outPath: string,
): string[] {
  const { width, height } = FRAME[format];
  const total = inputs.reduce((sum, i) => sum + i.seconds, 0);
  const args: string[] = [];
  for (const input of inputs) args.push('-i', input.path);

  let next = inputs.length;
  const audioIndex: { voice?: number; music?: number } = {};
  if (audio.voicePath) {
    args.push('-i', audio.voicePath);
    audioIndex.voice = next++;
  }
  if (audio.musicPath) {
    args.push('-i', audio.musicPath);
    audioIndex.music = next++;
  }
  const hasAudio = audioIndex.voice !== undefined || audioIndex.music !== undefined;
  if (!hasAudio) {
    args.push(
      '-f',
      'lavfi',
      '-t',
      String(total),
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=44100',
    );
    audioIndex.voice = next;
  }

  const chains: string[] = [];
  inputs.forEach((input, i) => {
    if (input.kind === 'image') {
      const frames = Math.round(input.seconds * FPS);
      // Scale to twice the frame so the zoom stays sharp, then crop to the frame's aspect ratio.
      chains.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
          `crop=${width * 2}:${height * 2},` +
          `zoompan=z='min(zoom+0.0008\\,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${FPS},` +
          `setsar=1,format=yuv420p[v${i}]`,
      );
    } else {
      // Provider clip: hold the last frame if it is shorter than the scene, then cut to length.
      chains.push(
        `[${i}:v]tpad=stop_mode=clone:stop_duration=${input.seconds},trim=0:${input.seconds},setpts=PTS-STARTPTS,` +
          `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},` +
          `fps=${FPS},setsar=1,format=yuv420p[v${i}]`,
      );
    }
  });
  const labels = inputs.map((_, i) => `[v${i}]`).join('');
  chains.push(`${labels}concat=n=${inputs.length}:v=1:a=0[vout]`);

  if (audioIndex.voice !== undefined && audioIndex.music !== undefined) {
    chains.push(
      `[${audioIndex.voice}:a]apad,atrim=0:${total},asetpts=PTS-STARTPTS[va]`,
      `[${audioIndex.music}:a]volume=${MUSIC_LEVEL},aloop=loop=-1:size=2000000000,atrim=0:${total},asetpts=PTS-STARTPTS[ma]`,
      `[va][ma]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
    );
  } else if (audioIndex.voice !== undefined) {
    chains.push(`[${audioIndex.voice}:a]apad,atrim=0:${total},asetpts=PTS-STARTPTS[aout]`);
  } else {
    chains.push(
      `[${audioIndex.music}:a]volume=${MUSIC_LEVEL},aloop=loop=-1:size=2000000000,atrim=0:${total},asetpts=PTS-STARTPTS[aout]`,
    );
  }

  args.push('-filter_complex', chains.join(';'));
  args.push(
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '21',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-t',
    String(total),
    '-movflags',
    '+faststart',
    '-map_metadata',
    '-1',
    outPath,
  );
  return args;
}

/** Runs ffmpeg. Error text is kept short and never contains file contents. */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2_000);
    });
    proc.on('error', (err) => reject(new Error(`ffmpeg could not start: ${err.name}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `ffmpeg exited with ${code}: ${stderr.split('\n').slice(-3).join(' | ').slice(0, 300)}`,
          ),
        );
    });
  });
}
