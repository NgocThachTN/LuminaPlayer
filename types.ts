export interface LyricLine {
  time: number; // In seconds
  text: string;
}

export interface LyricsResult {
  synced: LyricLine[]; // Synced lyrics with timestamps
  plain: string[]; // Plain lyrics without timestamps
  isSynced: boolean; // Whether synced lyrics are available
}

export interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  year?: number;
}

export interface SongState {
  file: File | null;
  url: string;
  metadata: SongMetadata;
  lyrics: LyricsResult;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: File[];
  currentSongIndex: number;
  repeatMode: 'off' | 'all' | 'one';
  isShuffle: boolean;
}

// Album and Artist grouping
export interface AlbumInfo {
  name: string;
  artist: string;
  cover?: string;
  trackIndices: number[]; // Indices in playlistItems
  year?: number;
}

export interface ArtistInfo {
  name: string;
  cover?: string; // First album cover
  trackIndices: number[];
  albumCount: number;
}

// Extended playlist item with cached metadata
export interface PlaylistItemMetadata {
  title: string;
  artist: string;
  album: string;
  cover?: string;
  duration?: number;
  year?: number;
}
