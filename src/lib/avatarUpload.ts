import { supabase } from './supabase';

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

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
  const filePath = `avatars/${userId}/${fileName}`;

  try {
    // 1. Upload to 'user-content' bucket
    // Note: The bucket MUST be public and have RLS policies allowing uploads by authenticated users.
    // If you see "new row violates row-level security policy", check your Storage policies in Supabase Dashboard.
    // For now, we try to upload.
    const { error: uploadError } = await supabase.storage
      .from('user-content')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw uploadError;
    }

    // 2. Get Public URL
    const { data } = supabase.storage
      .from('user-content')
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error('Failed to retrieve public URL');
    }

    return data.publicUrl;

  } catch (err: any) {
    console.error('Avatar upload failed:', err);
    throw new Error(err.message || 'Failed to upload image');
  }
}
