export function getPosterCandidatesFromVideoSrc(videoSrc: string): string[] {
  if (!videoSrc) return [];
  const clean = videoSrc.split('?')[0];
  const match = clean.match(/^(.*\/)([^/]+)\.(mp4|webm)$/i);
  if (!match) return [];
  const [, dir, filename] = match;
  return [
    `${dir}posters/${filename}.webp`,
    `${dir}${filename}.webp`,
    `${dir}${filename}.png`,
  ];
}

export function pickFirstPosterCandidate(videoSrc: string): string | undefined {
  const candidates = getPosterCandidatesFromVideoSrc(videoSrc);
  return candidates[0];
}
