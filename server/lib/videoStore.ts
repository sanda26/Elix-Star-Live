/**
 * In-memory video store. Videos persist until server restarts.
 * Replace with PostgreSQL when DATABASE_URL is configured.
 */

export interface Video {
  id: string;
  url: string;
  thumbnail: string;
  duration: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  description: string;
  hashtags: string[];
  music: { id: string; title: string; artist: string; duration: number } | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  createdAt: string;
  privacy: string;
}

const videos = new Map<string, Video>();

export function addVideo(video: Video): void {
  videos.set(video.id, video);
}

export function getVideo(id: string): Video | undefined {
  return videos.get(id);
}

export function deleteVideo(id: string): boolean {
  return videos.delete(id);
}

export function getAllVideos(): Video[] {
  return Array.from(videos.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getVideosByUser(userId: string): Video[] {
  return getAllVideos().filter((v) => v.userId === userId);
}

export function incrementStat(
  videoId: string,
  stat: "views" | "likes" | "comments" | "shares" | "saves"
): void {
  const v = videos.get(videoId);
  if (v) v[stat]++;
}

export function decrementStat(
  videoId: string,
  stat: "views" | "likes" | "comments" | "shares" | "saves"
): void {
  const v = videos.get(videoId);
  if (v) v[stat] = Math.max(0, v[stat] - 1);
}

export function getVideoCount(): number {
  return videos.size;
}
