// Tauri API Service - Wrapper for Tauri commands with same interface as electronAPI
import { invoke } from '@tauri-apps/api/core';

interface FileBuffer {
  buffer: string; // base64 encoded
  mime_type: string;
  name: string;
}

interface FileInfo {
  title: string;
  artist: string;
  name: string;
  size?: number;
}

interface DiscordPresenceData {
  title?: string;
  artist?: string;
  isPlaying: boolean;
  currentTime?: number;
  duration?: number;
  cover?: string;
  album?: string;
}

// Check if running in Tauri environment
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Tauri API object with same interface as electronAPI
export const tauriAPI = {
  // API Key
  getApiKey: async (): Promise<string> => {
    return await invoke<string>('get_api_key');
  },
  
  setApiKey: async (apiKey: string): Promise<boolean> => {
    return await invoke<boolean>('set_api_key', { apiKey });
  },
  
  hasApiKey: async (): Promise<boolean> => {
    return await invoke<boolean>('has_api_key');
  },

  // Playlist persistence
  savePlaylist: async (items: unknown[]): Promise<boolean> => {
    return await invoke<boolean>('save_playlist', { items });
  },
  
  getPlaylist: async (): Promise<unknown[]> => {
    return await invoke<unknown[]>('get_playlist');
  },
  
  saveCurrentIndex: async (index: number): Promise<boolean> => {
    return await invoke<boolean>('save_current_index', { index });
  },
  
  getCurrentIndex: async (): Promise<number> => {
    return await invoke<number>('get_current_index');
  },

  // File operations
  readFileBuffer: async (filePath: string): Promise<{ buffer: string; mimeType: string; name: string } | null> => {
    const result = await invoke<FileBuffer | null>('read_file_buffer', { filePath });
    if (!result) return null;
    return {
      buffer: result.buffer,
      mimeType: result.mime_type,
      name: result.name,
    };
  },
  
  fileExists: async (filePath: string): Promise<boolean> => {
    return await invoke<boolean>('file_exists', { filePath });
  },

  // Dialog operations
  openFolderDialog: async (): Promise<string[]> => {
    return await invoke<string[]>('open_folder_dialog');
  },
  
  openFileDialog: async (): Promise<string[]> => {
    return await invoke<string[]>('open_file_dialog');
  },

  // Metadata
  getFileInfo: async (filePath: string): Promise<FileInfo> => {
    return await invoke<FileInfo>('get_file_info', { filePath });
  },
  
  // Note: extractMetadata is handled in frontend using music-metadata library
  extractMetadata: async (filePath: string): Promise<{ title: string; artist: string; album: string; cover?: string; duration?: number }> => {
    // For Tauri, we use the frontend music-metadata library
    // This is a placeholder that returns basic file info
    const info = await invoke<FileInfo>('get_file_info', { filePath });
    return {
      title: info.title,
      artist: info.artist,
      album: 'Unknown Album',
      cover: undefined,
      duration: undefined,
    };
  },

  // Discord Rich Presence (placeholder - will use frontend JS library)
  updateDiscordPresence: async (data: DiscordPresenceData): Promise<boolean> => {
    return await invoke<boolean>('update_discord_presence', { data });
  },
  
  clearDiscordPresence: async (): Promise<boolean> => {
    return await invoke<boolean>('clear_discord_presence');
  },

  // LDAC (placeholder)
  checkLdacSupport: async (): Promise<boolean> => {
    return await invoke<boolean>('check_ldac_support');
  },

  // Flag to identify Tauri environment
  isTauri: true,
  isElectron: false,
};

// Universal API that works in both Electron and Tauri
export const getDesktopAPI = () => {
  if (typeof window !== 'undefined') {
    // Check for Tauri first
    if ('__TAURI__' in window) {
      return tauriAPI;
    }
    // Then check for Electron
    if ('electronAPI' in window) {
      return (window as unknown as { electronAPI: typeof tauriAPI }).electronAPI;
    }
  }
  return null;
};

export default tauriAPI;
