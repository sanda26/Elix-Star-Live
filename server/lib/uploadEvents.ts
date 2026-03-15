/**
 * Upload pipeline events (target architecture: Upload Service -> Object Storage -> Event Queue -> Workers).
 * Event shape for "video.uploaded" so processing workers (transcode, thumbnails, moderation) can consume later.
 * When a queue (Kafka/RabbitMQ) is added, publishVideoUploaded should push to the queue instead of no-op.
 */

export interface VideoUploadedPayload {
  path: string;
  cdnUrl: string;
  userId: string;
  contentType: string;
  uploadedAt: string;
  sizeBytes?: number;
}

export const VIDEO_UPLOADED_EVENT = "video.uploaded";

/**
 * Publish "video.uploaded" after a video file is stored in object storage.
 * No-op until a queue (e.g. REDIS_URL/KAFKA_BROKERS) is configured; then wire to Kafka/RabbitMQ.
 */
export function publishVideoUploaded(payload: VideoUploadedPayload): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[uploadEvents] ${VIDEO_UPLOADED_EVENT}`, payload.path);
  }
  // TODO: when queue is configured, e.g. producer.send({ topic: 'video.uploads', messages: [{ value: JSON.stringify(payload) }] })
}
