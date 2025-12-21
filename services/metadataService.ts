import jsmediatags from 'jsmediatags';
import { SongMetadata } from '../types';

export const extractMetadata = (file: File): Promise<SongMetadata> => {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        const { tags } = tag;
        let coverUrl = '';

        if (tags.picture) {
          const { data, format } = tags.picture;
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
        }

        // Fallback to filename parsing if title/artist are missing
        const filename = file.name.replace(/\.[^/.]+$/, "");
        const parts = filename.split('-').map(p => p.trim());
        const fallbackTitle = (parts[1] || parts[0]).toUpperCase();
        const fallbackArtist = (parts[1] ? parts[0] : 'UNKNOWN ARTIST').toUpperCase();

        resolve({
          title: tags.title ? tags.title.toUpperCase() : fallbackTitle,
          artist: tags.artist ? tags.artist.toUpperCase() : fallbackArtist,
          album: tags.album,
          cover: coverUrl || `https://picsum.photos/seed/${filename}/1000/1000`
        });
      },
      onError: (error) => {
        console.error('Error reading tags:', error);
        // Fallback to filename parsing
        const filename = file.name.replace(/\.[^/.]+$/, "");
        const parts = filename.split('-').map(p => p.trim());
        
        resolve({
          title: (parts[1] || parts[0]).toUpperCase(),
          artist: (parts[1] ? parts[0] : 'UNKNOWN ARTIST').toUpperCase(),
          cover: `https://picsum.photos/seed/${filename}/1000/1000`
        });
      }
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
