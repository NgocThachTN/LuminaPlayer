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
}
