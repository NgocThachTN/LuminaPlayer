// Type declarations for Electron API
interface FileBuffer {
  buffer: string; // base64 encoded
  mimeType: string;
  name: string;
}

interface ElectronAPI {
  // API Key
  getApiKey: () => Promise<string>;
  setApiKey: (apiKey: string) => Promise<boolean>;
  hasApiKey: () => Promise<boolean>;

  // Playlist persistence
  savePlaylist: (filePaths: string[]) => Promise<boolean>;
  getPlaylist: () => Promise<string[]>;
  saveCurrentIndex: (index: number) => Promise<boolean>;
  getCurrentIndex: () => Promise<number>;

  // File operations
  readFileBuffer: (filePath: string) => Promise<FileBuffer | null>;
  fileExists: (filePath: string) => Promise<boolean>;

  // Dialog operations
  openFolderDialog: () => Promise<string[]>;
  refreshMusicFolder: () => Promise<string[]>;
  openFileDialog: () => Promise<string[]>;
  
  // Metadata
  getFileInfo: (filePath: string) => Promise<{ title: string; artist: string; name: string; size?: number }>;
  extractMetadata: (filePath: string) => Promise<{ title: string; artist: string; album: string; cover?: string; duration?: number }>;
  fetchYouTubeMusicLyrics: (title: string, artist: string, album?: string) => Promise<{ lyrics: string; synced?: { time: number; text: string }[]; videoId?: string; title?: string; artist?: string } | null>;
  
  // Discord Rich Presence
  getDiscordPresenceEnabled: () => Promise<boolean>;
  setDiscordPresenceEnabled: (enabled: boolean) => Promise<boolean>;
  updateDiscordPresence: (data: DiscordPresenceData) => Promise<boolean>;
  preloadDiscordCover: (data: { title: string; artist: string; album?: string }) => Promise<string | null>;
  clearDiscordPresence: () => Promise<boolean>;
  checkLdacSupport: () => Promise<boolean>;
  
  isElectron: boolean;
}

interface DiscordPresenceData {
  title?: string;
  artist?: string;
  isPlaying: boolean;
  currentTime?: number;
  duration?: number;
  cover?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
