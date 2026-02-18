import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env' });

// Supabase configuration from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createGiftsBucket() {
  console.log('🪣 Creating gifts bucket...');
  
  try {
    // Create the bucket if it doesn't exist
    const { data, error } = await supabase.storage.createBucket('gift-videos', {
      public: true,
      allowedMimeTypes: ['video/mp4', 'video/webm', 'image/png', 'image/gif'],
      fileSizeLimit: 10485760, // 10MB
    });

    if (error && !error.message.includes('already exists')) {
      console.error('❌ Error creating bucket:', error);
      return false;
    }

    console.log('✅ Gifts bucket created/verified');
    return true;
  } catch (error) {
    console.error('❌ Error creating bucket:', error);
    return false;
  }
}

async function uploadGiftsToStorage() {
  console.log('📤 Uploading gifts to Supabase Storage...');
  
  const giftsDir = join(process.cwd(), 'public', 'gifts');
  
  try {
    const files = readdirSync(giftsDir);
    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      const filePath = join(giftsDir, file);
      const stats = statSync(filePath);
      
      if (stats.isFile()) {
        const fileExt = extname(file);
        const fileName = file;
        
        try {
          const fileBuffer = readFileSync(filePath);
          
          const { data, error } = await supabase.storage
            .from('gift-videos')
            .upload(fileName, fileBuffer, {
              contentType: fileExt === '.mp4' ? 'video/mp4' : 'image/png',
              upsert: true
            });

          if (error) {
            console.error(`❌ Failed to upload ${file}:`, error);
            failed++;
          } else {
            console.log(`✅ Uploaded ${file}`);
            uploaded++;
          }
        } catch (uploadError) {
          console.error(`❌ Error uploading ${file}:`, uploadError);
          failed++;
        }
      }
    }

    console.log(`\n📊 Upload Summary:`);
    console.log(`✅ Uploaded: ${uploaded} files`);
    console.log(`❌ Failed: ${failed} files`);
    
    return uploaded > 0;
  } catch (error) {
    console.error('❌ Error reading gifts directory:', error);
    return false;
  }
}

async function getPublicUrls() {
  console.log('🔗 Getting public URLs...');
  
  try {
    const { data, error } = await supabase.storage
      .from('gift-videos')
      .list('', { limit: 1000 });

    if (error) {
      console.error('❌ Error listing files:', error);
      return [];
    }

    const urls = [];
    for (const file of data) {
      const { data: { publicUrl } } = supabase.storage
        .from('gift-videos')
        .getPublicUrl(file.name);
      
      urls.push({
        name: file.name,
        url: publicUrl
      });
    }

    console.log(`✅ Generated ${urls.length} public URLs`);
    return urls;
  } catch (error) {
    console.error('❌ Error getting URLs:', error);
    return [];
  }
}

async function main() {
  console.log('🚀 Setting up Supabase Storage for Gifts...\n');

  // Step 1: Create bucket
  const bucketCreated = await createGiftsBucket();
  if (!bucketCreated) {
    console.log('❌ Failed to create bucket. Exiting.');
    process.exit(1);
  }

  // Step 2: Upload gifts
  const uploaded = await uploadGiftsToStorage();
  if (!uploaded) {
    console.log('❌ Failed to upload gifts. Exiting.');
    process.exit(1);
  }

  // Step 3: Get public URLs
  const urls = await getPublicUrls();
  
  // Step 4: Save URLs to file for catalog update
  const urlsFile = join(process.cwd(), 'gift-storage-urls.json');
  require('fs').writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
  
  console.log(`\n📁 Public URLs saved to: ${urlsFile}`);
  console.log('\n🎉 Supabase Storage setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Update gifts catalog to use storage URLs');
  console.log('2. Implement preload and fallback logic');
  console.log('3. Test gift loading from storage');
}

main().catch(console.error);