
import { SongMetadata } from '../types';

// Simplified Web Metadata Extraction (No external deps)
export const extractMetadata = (file: File): Promise<SongMetadata> => {
  return new Promise((resolve) => {
    // Basic filename parsing for Web Version
    const filename = file.name.replace(/\.[^/.]+$/, "");
    const parts = filename.split('-').map(p => p.trim());
    
    // Pattern: Artist - Title or 01 - Title
    let title = (parts[1] || parts[0]).toUpperCase();
    let artist = (parts[1] ? parts[0] : 'UNKNOWN ARTIST').toUpperCase();
    
    // Simple heuristic: if first part is number, it's track num, so second part is title
    if (/^\d+$/.test(parts[0]) && parts[1]) {
        title = parts[1].toUpperCase();
        artist = 'UNKNOWN ARTIST';
    }

    resolve({
      title,
      artist,
      album: 'Unknown Album',
      cover: undefined // No cover extraction in web version for now
    });
  });
};

export const resolveITunesCoverUrl = async (title: string, artist: string): Promise<string | null> => {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
    const data = await response.json();
    
    if (data.resultCount > 0 && data.results[0].artworkUrl100) {
      // Get higher resolution (100x100 -> 600x600)
      return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
    }
    return null;
  } catch (e) {
    console.warn("iTunes Cover Search Failed:", e);
    return null;
  }
};
