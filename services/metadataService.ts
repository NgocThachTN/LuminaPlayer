
import { SongMetadata } from '../types';

import { parseBlob } from 'music-metadata';

// Simplified Web Metadata Extraction (No external deps) -> Now using music-metadata
export const extractMetadata = async (file: File): Promise<SongMetadata> => {
  try {
    const metadata = await parseBlob(file);
    const { common } = metadata;
    
    // Normalize helper
    const toTitleCase = (str: string) => {
      return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    };

    let title = common.title ? toTitleCase(common.title) : undefined;
    let artist = common.artist ? toTitleCase(common.artist) : undefined;
    let album = common.album ? toTitleCase(common.album) : undefined;
    let cover: string | undefined = undefined;

    // Fallback if tags are missing
    if (!title) {
        // Basic filename parsing
        const filename = file.name.replace(/\.[^/.]+$/, "");
        const parts = filename.split('-').map(p => p.trim());
        
        // Pattern: Artist - Title or 01 - Title
        title = (parts[1] || parts[0]);
        if (!artist && parts[1]) {
             artist = parts[0];
        }
        
        // Simple heuristic: if first part is number, it's track num, so second part is title
        if (/^\d+$/.test(parts[0]) && parts[1]) {
             title = parts[1];
             if(!artist) artist = 'Unknown Artist';
        }
        
        if (title) title = toTitleCase(title);
        if (artist) artist = toTitleCase(artist);
    }

    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const blob = new Blob([picture.data as any], { type: picture.format });
      cover = URL.createObjectURL(blob);
    }

    return {
      title: title || "Unknown Title",
      artist: artist || "Unknown Artist",
      album: album || "Unknown Album",
      cover
    };
  } catch (e) {
    console.error("Error parsing metadata:", e);
    // Fallback to basic filename parsing on error
    const filename = file.name.replace(/\.[^/.]+$/, "");
    return {
      title: filename,
      artist: "Unknown Artist",
      album: "Unknown Album",
      cover: undefined
    };
  }
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
