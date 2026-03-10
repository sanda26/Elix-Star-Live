import { noopClient } from './noopClient';

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  // Storage is not configured (no backend storage); upload will no-op and return empty URL
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  // Validate file size (max 5MB)
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Image is too large (max 5MB).');
  }

  // Generate clean filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  try {
    const { error: uploadError } = await noopClient.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {

      throw uploadError;
    }

    // 2. Get Public URL
    const { data } = noopClient.storage
      .from('avatars')
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error('Failed to retrieve public URL');
    }

    return data.publicUrl;

  } catch (err: any) {

    throw new Error(err.message || 'Failed to upload image');
  }
}
