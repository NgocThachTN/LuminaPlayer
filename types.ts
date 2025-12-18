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
  lyrics: string[]; // Plain lyrics - array of lines
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: File[];
  currentSongIndex: number;
}
