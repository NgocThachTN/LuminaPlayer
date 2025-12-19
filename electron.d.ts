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
  openFileDialog: () => Promise<string[]>;
  
  // Metadata
  getFileInfo: (filePath: string) => Promise<{ title: string; artist: string; name: string; size?: number }>;
  extractMetadata: (filePath: string) => Promise<{ title: string; artist: string; album: string; cover?: string }>;
  
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
