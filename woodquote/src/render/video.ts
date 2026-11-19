// Video export: every frame is rendered in studio quality and encoded to
// MP4 (H.264) on devices that support it (Windows, Android, recent iPhones),
// or WebM otherwise. Frames are rendered one by one, not recorded live, so the
// video is smooth however slow the device is.
import type { CameraView } from '../app/media';
import type { Studio } from './studio';

export type VideoPath = 'turntable' | 'half-turn' | 'views';

export interface VideoOptions {
  path: VideoPath;
  seconds: number;
  fps: number;
  width: number;
  height: number;
  /** studio super-sampling level per frame (0 = fastest) */
  quality: number;
  start: CameraView;
  views: CameraView[];
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

async function mp4Supported(w: number, h: number) {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of ['avc1.640033', 'avc1.4d0033', 'avc1.42003e']) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 12_000_000, framerate: 30 });
      if (r.supported) return codec;
    } catch {
      /* try the next profile */
    }
  }
  return null;
}

function placeCamera(studio: Studio, o: VideoOptions, t: number) {
  if (o.path === 'turntable') studio.turntable(t, o.start, 1);
  else if (o.path === 'half-turn') studio.turntable(t * 0.5 - 0.25, o.start, 1);
  else studio.flyThrough(t, o.views.length ? o.views : [o.start]);
}

export async function renderVideo(studio: Studio, o: VideoOptions, onProgress: (p: number) => void, cancelled: () => boolean): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  const w = even(o.width);
  const h = even(o.height);
  const frames = Math.max(2, Math.round(o.seconds * o.fps));
  const codec = await mp4Supported(w, h);
  const canvas = studio.canvas();

  if (codec) {
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: 'avc', width: w, height: h, frameRate: o.fps }, fastStart: 'in-memory' });
    let failed: Error | null = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failed = e as Error) });
    enc.configure({ codec, width: w, height: h, bitrate: Math.round(w * h * o.fps * 0.15), framerate: o.fps });
    for (let i = 0; i < frames && !cancelled(); i++) {
      if (failed) throw failed;
      placeCamera(studio, o, i / (frames - (o.path === 'turntable' ? 0 : 1)));
      studio.renderStudioFrame(w, h, o.quality);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / o.fps), duration: Math.round(1_000_000 / o.fps) });
      enc.encode(frame, { keyFrame: i % (o.fps * 2) === 0 });
      frame.close();
      // keep the encoder's queue short so memory stays low
      while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
      onProgress((i + 1) / frames);
      await new Promise((r) => setTimeout(r, 0));
    }
    await enc.flush();
    enc.close();
    muxer.finalize();
    if (cancelled()) throw new Error('cancelled');
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), mime: 'video/mp4', width: w, height: h };
  }

  // fallback: record the canvas, adding each finished frame by hand
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: Math.round(w * h * o.fps * 0.15) });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const step = 1000 / o.fps;
  for (let i = 0; i < frames && !cancelled(); i++) {
    const t0 = performance.now();
    placeCamera(studio, o, i / (frames - (o.path === 'turntable' ? 0 : 1)));
    studio.renderStudioFrame(w, h, Math.min(o.quality, 1));
    track.requestFrame?.();
    onProgress((i + 1) / frames);
    // recording runs in real time: wait out the rest of the frame
    await new Promise((r) => setTimeout(r, Math.max(0, step - (performance.now() - t0))));
  }
  rec.stop();
  await stopped;
  if (cancelled()) throw new Error('cancelled');
  const type = (mime || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), mime: type, width: w, height: h };
}
