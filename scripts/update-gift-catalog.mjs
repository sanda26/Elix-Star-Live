import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateGiftsCatalog() {
  console.log('🔄 Updating gifts catalog to use Supabase Storage URLs...');
  
  try {
    // Get all files from storage
    const { data: files, error: listError } = await supabase.storage
      .from('gift-videos')
      .list('', { limit: 1000 });

    if (listError) {
      console.error('❌ Error listing storage files:', listError);
      return false;
    }

    console.log(`📁 Found ${files.length} files in storage`);

    // Read current gifts catalog
    const catalogPath = './src/lib/giftsCatalog.ts';
    let catalogContent = readFileSync(catalogPath, 'utf8');

    // Update each gift URL in the catalog
    let updatedCount = 0;
    for (const file of files) {
      const { data: { publicUrl } } = supabase.storage
        .from('gift-videos')
        .getPublicUrl(file.name);

      // Replace local paths with storage URLs
      const oldPath = `/gifts/${file.name}`;
      const newPath = publicUrl;
      
      if (catalogContent.includes(oldPath)) {
        catalogContent = catalogContent.replace(oldPath, newPath);
        updatedCount++;
        console.log(`✅ Updated ${file.name} -> ${newPath}`);
      }
    }

    // Write updated catalog
    require('fs').writeFileSync(catalogPath, catalogContent);
    
    console.log(`\n📊 Update Summary:`);
    console.log(`✅ Updated ${updatedCount} gift URLs`);
    console.log(`📁 Catalog saved to: ${catalogPath}`);
    
    return updatedCount > 0;
  } catch (error) {
    console.error('❌ Error updating catalog:', error);
    return false;
  }
}

async function createGiftStorageService() {
  console.log('🔧 Creating gift storage service...');
  
  const serviceContent = `import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface GiftStorageUrls {
  [key: string]: string;
}

class GiftStorageService {
  private static instance: GiftStorageService;
  private storageUrls: GiftStorageUrls = {};
  private preloadedGifts: Set<string> = new Set();
  private fallbackGifts = ['rose', 'heart']; // Local fallback gifts

  static getInstance(): GiftStorageService {
    if (!GiftStorageService.instance) {
      GiftStorageService.instance = new GiftStorageService();
    }
    return GiftStorageService.instance;
  }

  async initializeStorageUrls() {
    try {
      const { data, error } = await supabase.storage
        .from('gift-videos')
        .list('', { limit: 1000 });

      if (error) {
        console.error('Error loading storage URLs:', error);
        return;
      }

      for (const file of data) {
        const { data: { publicUrl } } = supabase.storage
          .from('gift-videos')
          .getPublicUrl(file.name);
        
        this.storageUrls[file.name] = publicUrl;
      }

      console.log(\`✅ Loaded \${Object.keys(this.storageUrls).length} gift storage URLs\`);
    } catch (error) {
      console.error('Error initializing storage URLs:', error);
    }
  }

  getGiftUrl(giftName: string): string {
    // Try storage URL first
    if (this.storageUrls[giftName]) {
      return this.storageUrls[giftName];
    }
    
    // Fallback to local public folder
    return \`/gifts/\${giftName}\`;
  }

  async preloadTopGifts(giftNames: string[]) {
    console.log('🔄 Preloading top gifts...');
    
    for (const giftName of giftNames.slice(0, 10)) { // Top 10 gifts
      const url = this.getGiftUrl(giftName);
      
      try {
        // Preload video
        if (url.includes('.mp4')) {
          const video = document.createElement('video');
          video.preload = 'auto';
          video.src = url;
          video.style.display = 'none';
          document.body.appendChild(video);
          
          video.addEventListener('canplaythrough', () => {
            document.body.removeChild(video);
            this.preloadedGifts.add(giftName);
            console.log(\`✅ Preloaded \${giftName}\`);
          }, { once: true });
        }
        // Preload image
        else if (url.includes('.png')) {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            this.preloadedGifts.add(giftName);
            console.log(\`✅ Preloaded \${giftName}\`);
          };
        }
      } catch (error) {
        console.error(\`❌ Failed to preload \${giftName}:\`, error);
      }
    }
  }

  isGiftPreloaded(giftName: string): boolean {
    return this.preloadedGifts.has(giftName);
  }

  getFallbackGifts(): string[] {
    return this.fallbackGifts;
  }
}

export const giftStorage = GiftStorageService.getInstance();`;

  require('fs').writeFileSync('./src/lib/giftStorage.ts', serviceContent);
  console.log('✅ Created gift storage service');
}

async function main() {
  console.log('🚀 Setting up gift storage integration...\n');

  // Step 1: Update gifts catalog
  const catalogUpdated = await updateGiftsCatalog();
  if (!catalogUpdated) {
    console.log('❌ Failed to update catalog');
    return;
  }

  // Step 2: Create storage service
  await createGiftStorageService();

  console.log('\n🎉 Gift storage setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Import giftStorage in components');
  console.log('2. Initialize storage URLs on app start');
  console.log('3. Update GiftOverlay to use storage URLs');
  console.log('4. Implement preload logic');
}

main().catch(console.error);