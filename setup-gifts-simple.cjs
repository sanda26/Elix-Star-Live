// Simple gift setup script - direct database insertion
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://drjllfprvymqoxappogt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyamxsZnBydnltcW94YXBwb2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc1OTg4NCwiZXhwIjoyMDg0MzM1ODg0fQ.p6rBtKqYu7YQnLqZm5wXJtVhSjk6TmFpJz6vHJz8Q3Y';

const supabase = createClient(supabaseUrl, supabaseKey);

// Gift data to insert
const gifts = [
  {
    gift_id: 'fire_phoenix',
    name: 'Fire Phoenix',
    gift_type: 'small',
    coin_cost: 100,
    animation_url: 'gift-videos/fire_phoenix.png',
    sfx_url: null,
    is_active: true
  },
  {
    gift_id: 'fantasy_unicorn',
    name: 'Fantasy Unicorn',
    gift_type: 'small',
    coin_cost: 150,
    animation_url: 'gift-videos/fantasy_unicorn.png',
    sfx_url: null,
    is_active: true
  },
  {
    gift_id: 'elix_gold_universe',
    name: 'Gold Universe',
    gift_type: 'big',
    coin_cost: 500,
    animation_url: 'gift-videos/elix_gold_universe.png',
    sfx_url: null,
    is_active: true
  },
  {
    gift_id: 'crown_kitty_treasure',
    name: 'Crown Kitty',
    gift_type: 'big',
    coin_cost: 1000,
    animation_url: 'gift-videos/crown_kitty_treasure.png',
    sfx_url: null,
    is_active: true
  },
  {
    gift_id: 'elix_global_universe',
    name: 'Elix Universe',
    gift_type: 'universe',
    coin_cost: 2000,
    animation_url: 'gift-videos/elix_global_universe.png',
    sfx_url: null,
    is_active: true
  }
];

async function addGiftsToDatabase() {
  console.log('🎁 Adding gifts to database...');
  
  try {
    // Clear existing gifts first
    console.log('🎁 Clearing existing gifts...');
    const { error: deleteError } = await supabase
      .from('gifts_catalog')
      .delete()
      .neq('gift_id', 'dummy');
    
    if (deleteError) {
      console.error('🎁 Error clearing existing gifts:', deleteError);
    } else {
      console.log('🎁 Cleared existing gifts');
    }
    
    // Insert new gifts
    console.log('🎁 Inserting new gifts...');
    const { data, error } = await supabase
      .from('gifts_catalog')
      .insert(gifts)
      .select();
    
    if (error) {
      console.error('🎁 Error inserting gifts:', error);
      return false;
    }
    
    console.log('🎁 Successfully added gifts:', data);
    console.log(`🎁 Added ${data.length} gifts to database`);
    return true;
    
  } catch (err) {
    console.error('🎁 Failed to add gifts:', err);
    return false;
  }
}

// Run the function
addGiftsToDatabase().then(success => {
  if (success) {
    console.log('🎁 Gift database setup complete!');
  } else {
    console.log('🎁 Failed to setup gift database');
  }
  process.exit(success ? 0 : 1);
});