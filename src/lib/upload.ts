import { supabase } from "@/integrations/supabase/client";

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
}

export interface ResizeOptions {
  max?: number;
  quality?: number;
}

/**
 * Upload an image to Supabase storage and return the public URL
 */
export async function uploadImage({ bucket, path, file }: UploadOptions): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}

/**
 * Resize an image and convert to WebP format
 */
export async function resizeToWebP(
  file: File, 
  options: ResizeOptions = {}
): Promise<File> {
  const { max = 1024, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > max || height > max) {
        if (width > height) {
          height = (height * max) / width;
          width = max;
        } else {
          width = (width * max) / height;
          height = max;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to resize image'));
            return;
          }
          
          const resizedFile = new File([blob], 'image.webp', {
            type: 'image/webp',
            lastModified: Date.now()
          });
          
          resolve(resizedFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}