
export interface LyricLine {
  time: number; // In seconds
  text: string;
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
  lyrics: LyricLine[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: File[];
  currentSongIndex: number;
}
