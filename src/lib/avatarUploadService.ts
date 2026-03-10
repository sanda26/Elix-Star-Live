import { noopClient } from './noopClient';

export interface AvatarUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

export class AvatarUploadService {
  /**
   * Upload and process avatar image
   */
  async uploadAvatar(
    file: File,
    userId: string
  ): Promise<AvatarUploadResult> {
    try {
      // Validate file
      const validation = await this.validateImageFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Process image (resize, compress)
      const processedFile = await this.processImage(file);
      
      // Generate unique file path
      const fileExt = processedFile.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await noopClient.storage
        .from('avatars')
        .upload(fileName, processedFile, {
          upsert: true,
          contentType: processedFile.type,
          cacheControl: '3600'
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = noopClient.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile
      const { error: updateError } = await noopClient
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) {
        // Clean up uploaded file if profile update fails
        await noopClient.storage
          .from('avatars')
          .remove([fileName]);
        
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      return { success: true, publicUrl };
    } catch (error) {

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Remove avatar
   */
  async removeAvatar(userId: string): Promise<AvatarUploadResult> {
    try {
      // Get current avatar URL
      const { data: profile, error: fetchError } = await noopClient
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch profile: ${fetchError.message}`);
      }

      // Remove from storage if URL exists
      if (profile?.avatar_url) {
        const filePath = this.extractFilePathFromUrl(profile.avatar_url);
        if (filePath) {
          const { error: deleteError } = await noopClient.storage
            .from('avatars')
            .remove([filePath]);

          if (deleteError) {

          }
        }
      }

      // Update profile to remove avatar URL
      const { error: updateError } = await noopClient
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      return { success: true };
    } catch (error) {

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Removal failed' 
      };
    }
  }

  /**
   * Validate image file
   */
  private async validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'Invalid file type. Please use JPG, PNG, or WebP.' 
      };
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: 'File too large. Please use an image under 5MB.' 
      };
    }

    // Check minimum dimensions
    return new Promise<{ valid: boolean; error?: string }>((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        
        if (img.width < 100 || img.height < 100) {
          resolve({ 
            valid: false, 
            error: 'Image too small. Please use at least 100x100 pixels.' 
          });
        } else {
          resolve({ valid: true });
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve({ 
          valid: false, 
          error: 'Invalid image file.' 
        });
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Process image (resize and compress)
   */
  private async processImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(img.src);

        // Calculate new dimensions (max 400x400, maintain aspect ratio)
        const maxSize = 400;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and resize image
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(processedFile);
            } else {
              resolve(file); // Fallback to original file
            }
          },
          'image/jpeg',
          0.8 // 80% quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file); // Fallback to original file
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract file path from storage URL
   */
  private extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      const bucketIndex = pathParts.findIndex(part => part === 'avatars');
      if (bucketIndex !== -1 && pathParts.length > bucketIndex + 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get avatar URL with fallback
   */
  getAvatarUrl(avatarUrl: string | null, userId?: string): string {
    if (avatarUrl) {
      return avatarUrl;
    }
    
    // Generate a unique placeholder avatar
    if (userId) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
    }
    
    return '/images/default-avatar.png';
  }

  /**
   * Check if avatar exists
   */
  async checkAvatarExists(avatarUrl: string): Promise<boolean> {
    try {
      const response = await fetch(avatarUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate avatar preview
   */
  generatePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}

// Export singleton instance
export const avatarUploadService = new AvatarUploadService();