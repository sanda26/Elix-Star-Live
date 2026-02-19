
import { supabase } from './supabase';
import { trackEvent } from './analytics';
import { boostNewVideo } from './fypEligibility';

export interface UploadProgress {
  stage: 'validating' | 'compressing' | 'uploading' | 'processing' | 'complete';
  progress: number; // 0-100
  message: string;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  size: number;
  format: string;
}

// Configuration
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DURATION = 180; // 3 minutes (in seconds)
const ALLOWED_FORMATS = ['video/mp4', 'video/quicktime', 'video/webm'];

export class VideoUploadService {
  private onProgressCallback: ((progress: UploadProgress) => void) | null = null;

  /**
   * Register callback for upload progress updates
   */
  onProgress(callback: (progress: UploadProgress) => void) {
    this.onProgressCallback = callback;
  }

  private updateProgress(stage: UploadProgress['stage'], progress: number, message: string) {
    if (this.onProgressCallback) {
      this.onProgressCallback({ stage, progress, message });
    }
  }

  /**
   * Validate video file before upload. Sync only – no metadata reading so upload never blocks.
   */
  validateVideo(file: File): VideoMetadata {
    this.updateProgress('validating', 10, 'Validating video...');

    const okType = ALLOWED_FORMATS.includes(file.type) || (file.type && file.type.startsWith('video/'));
    if (!okType) {
      throw new Error(`Invalid format. Use MP4 or WebM.`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    this.updateProgress('validating', 30, 'Validation complete');
    return { duration: 0, width: 0, height: 0, size: file.size, format: file.type };
  }

  /**
   * Get video metadata using browser API. If the browser can't read it (e.g. codec), return defaults so upload can continue.
   */
  private getVideoMetadata(file: File): Promise<VideoMetadata> {
    const defaults = {
      duration: 0,
      width: 0,
      height: 0,
      size: file.size,
      format: file.type,
    };
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        resolve(defaults);
      }, 5000);

      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(video.src);
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size,
          format: file.type,
        });
      };

      video.onerror = () => {
        clearTimeout(timeout);
        if (video.src) URL.revokeObjectURL(video.src);
        resolve(defaults);
      };

      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Upload video to storage
   */
  async uploadVideo(
    file: File,
    userId: string,
    metadata: { description: string; hashtags: string[]; isPrivate: boolean; music?: any }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('You must be logged in to upload. Try signing in again.');
      }
      if (!file || file.size === 0) {
        throw new Error('Video file is empty. Record or choose a valid video.');
      }
      
      const videoMeta = this.validateVideo(file);

      this.updateProgress('uploading', 40, 'Uploading video...');

      // Generate Video ID upfront
      const videoId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop() || 'mp4';
      
      // Structure: videos/{userId}/{videoId}/original.ext
      const fileName = `videos/${userId}/${videoId}/original.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-content')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'video/webm',
        });
        
      if (uploadError) {
        const msg = (uploadError as any)?.message ?? String(uploadError);
        throw new Error(`Storage failed: ${msg}. Check Supabase: bucket "user-content" exists.`);
      }

      this.updateProgress('uploading', 70, 'Upload complete');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-content')
        .getPublicUrl(fileName);

      this.updateProgress('processing', 80, 'Creating video record...');

      // Thumbnail
      let thumbnailUrl = 'https://picsum.photos/400/600';
      try {
        thumbnailUrl = await Promise.race([
          this.generateThumbnail(file, userId, videoId),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
      } catch {
        // keep placeholder
      }

      // Insert into 'videos' table
      const payload = {
        id: videoId,
        user_id: userId,
        url: publicUrl,
        thumbnail_url: thumbnailUrl,
        description: metadata.description || '',
        is_public: !metadata.isPrivate,
      };
      
      const { data, error } = await supabase
        .from('videos')
        .insert(payload)
        .select()
        .single();
      
      if (error) {
          console.error('Video insert error details:', error);
          if (error.code === '23503') { // foreign_key_violation
             throw new Error(`User ID mismatch (Code: 23503). Try logging out and back in.`);
          }
          throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
      }

      if (!data) {
        throw new Error('Database: No row returned');
      }
      
      const videoData = data;

      // Give new video an initial FYP boost so it gets early impressions
      try {
        await boostNewVideo(videoData.id);
      } catch {
        /* non-critical */
      }

      // Hashtags
      if (metadata.hashtags.length > 0) {
        try {
          await this.addHashtags(videoData.id, metadata.hashtags);
        } catch {
          /* ignore */
        }
      }

      this.updateProgress('complete', 100, 'Video uploaded successfully!');

      trackEvent('video_upload', {
        video_id: videoData.id,
        duration: videoMeta.duration,
        size_mb: (file.size / 1024 / 1024).toFixed(2),
      });

      return videoData.id;
    } catch (error: any) {
      console.error('Upload failed:', error);
      trackEvent('video_upload_failed', { error: String(error) });
      const msg = error?.message ?? error?.error_description ?? String(error);
      throw new Error(msg || 'Upload failed');
    }
  }

  /**
   * Generate thumbnail from video
   */
  private async generateThumbnail(file: File, userId: string, videoId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2); // 1 second or halfway
      };

      video.onseeked = async () => {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(async blob => {
            if (!blob) {
              reject(new Error('Failed to generate thumbnail'));
              return;
            }

            const fileName = `thumbnails/${userId}/${videoId}/thumb.jpg`;
            const { error } = await supabase.storage
              .from('user-content')
              .upload(fileName, blob);

            if (error) {
              console.warn('Thumbnail upload failed, using placeholder', error);
              resolve('https://picsum.photos/400/600'); // Fallback
              return;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('user-content')
              .getPublicUrl(fileName);

            resolve(publicUrl);
          }, 'image/jpeg', 0.85);
        } catch (error) {
          console.warn('Thumbnail generation failed', error);
          resolve('https://picsum.photos/400/600');
        }
      };

      video.onerror = () => {
        console.warn('Video load for thumbnail failed');
        resolve('https://picsum.photos/400/600');
      };

      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Add hashtags to video
   */
  private async addHashtags(videoId: string, hashtags: string[]) {
    // Clean and normalize hashtags
    const cleanTags = [...new Set(hashtags.map(tag => tag.toLowerCase().replace(/[^a-z0-9_]/g, '')))].filter(t => t.length > 0);

    for (const tag of cleanTags) {
      let hashtagId: string | null = null;

      // 1. Try to find existing hashtag
      const { data: existingTag } = await supabase
        .from('hashtags')
        .select('id, use_count')
        .eq('tag', tag)
        .single();

      if (existingTag) {
        hashtagId = existingTag.id;
        // Increment use count
        await supabase
            .from('hashtags')
            .update({ use_count: (existingTag.use_count || 0) + 1 })
            .eq('id', hashtagId);
      } else {
        // 2. Create new hashtag
        const { data: newTag, error } = await supabase
          .from('hashtags')
          .insert({ tag, use_count: 1 })
          .select('id')
          .single();
        
        if (newTag) {
          hashtagId = newTag.id;
        } else if (error) {
             const { data: retryTag } = await supabase.from('hashtags').select('id').eq('tag', tag).single();
             if (retryTag) hashtagId = retryTag.id;
        }
      }

      // 3. Link video to hashtag
      if (hashtagId) {
        await supabase
            .from('video_hashtags')
            .insert({ video_id: videoId, hashtag_id: hashtagId });
      }
    }
  }
}

export const videoUploadService = new VideoUploadService();
