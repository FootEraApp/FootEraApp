import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeStatic from 'ffprobe-static';

ffmpeg.setFfprobePath(ffprobeStatic.path);

export type MediaMeta = {
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
};

export async function probeImage(path: string): Promise<MediaMeta> {
  const m = await sharp(path).metadata();
  return {
    durationSec: null,
    width: m.width ?? null,
    height: m.height ?? null,
  };
}

export async function probeVideo(path: string): Promise<MediaMeta> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams?.find(s => s.codec_type === 'video');
      const duration = Number(data.format?.duration ?? 0);
      resolve({
        durationSec: Number.isFinite(duration) ? Math.round(duration) : null,
        width: stream?.width ?? null,
        height: stream?.height ?? null,
      });
    });
  });
}
