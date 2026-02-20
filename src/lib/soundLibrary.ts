import { supabase } from './supabase';

export type SoundTrack = {
  id: number;
  title: string;
  artist: string;
  duration: string;
  url: string;
  license: string;
  source: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
};

// Fetch sound tracks from database - NO HARDCODED DATA
export async function fetchSoundTracksFromDatabase(): Promise<SoundTrack[]> {
  try {
    const { data: soundData, error } = await supabase
      .from('sound_library')
      .select('*')
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (error) {

      return [];
    }

    return soundData || [];
  } catch (err) {

    return [];
  }
}

// Default empty track for when no music is selected
export const EMPTY_TRACK: SoundTrack = {
  id: 0,
  title: 'No Music',
  artist: '-',
  duration: '0:00',
  url: '',
  license: '-',
  source: 'Local',
  clipStartSeconds: 0,
  clipEndSeconds: 0
};