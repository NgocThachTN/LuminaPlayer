
import { useState, useMemo, useEffect, useTransition } from "react";
import { 
  PlaylistItem, 
  AlbumInfo, 
  ArtistInfo, 
  PlaylistItemMetadata,
  SongState
} from "../types";
import { extractMetadata } from "../../services/metadataService";

// Helper to check if running in Electron
const isElectron = !!(window as any).electronAPI;

export const useLibrary = (
  state: SongState,
  setState: React.Dispatch<React.SetStateAction<SongState>>,
  playSongFromItem: (item: PlaylistItem, index: number) => Promise<void>,
  onImportComplete?: () => void
) => {
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [hasCheckedSaved, setHasCheckedSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Helper to normalize text to Title Case
  const toTitleCase = (str: string) => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  };

  // Load saved playlist on startup (Electron only)
  useEffect(() => {
    const loadSavedPlaylist = async () => {
      const electronAPI = (window as any).electronAPI;
      if (!isElectron || !electronAPI) {
        setHasCheckedSaved(true);
        return;
      }

      try {
        const savedItems = await electronAPI.getPlaylist();
        
        if (savedItems && savedItems.length > 0) {
          const items: PlaylistItem[] = [];
          
          for (const item of savedItems) {
            // Normalize legacy string paths to objects
            const path = typeof item === 'string' ? item : item.path;
            
            // Verify file still exists
            const exists = await electronAPI.fileExists(path);
            if (exists) {
              if (typeof item === 'string') {
                items.push({
                  path: item,
                  name: item.split(/[/\\]/).pop() || item,
                });
              } else {
                 // Restore persisted metadata
                 items.push(item);
              }
            }
          }

          if (items.length > 0) {
            setPlaylistItems(items);
            // If we have some metadata (title/artist), we can consider it "loaded" for UI purposes
            // forcing a re-render with names immediately.
            const hasMetadata = items.some(i => i.metadata?.title);
            if (hasMetadata) {
               setMetadataLoaded(true);
            }
            
            // Load full metadata (covers) in background
            // We pass 'true' to indicate we want to refresh covers even if text exists
            loadAllMetadata(items);
          }
        }
      } catch (e) {
        console.error("Error loading saved playlist:", e);
      } finally {
        setHasCheckedSaved(true);
      }
    };

    loadSavedPlaylist();
  }, []);

  // Load metadata for all tracks (for album/artist grouping)
  const loadAllMetadata = async (items: PlaylistItem[]) => {
    setMetadataLoaded(false);
    const updatedItems = [...items];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // If we already have cover art, skip. 
      // If we have text metadata but NO cover, we let it run to get cover.
      if (item.metadata?.cover) continue;

      try {
        let metadata: PlaylistItemMetadata;
        const electronAPI = (window as any).electronAPI;

        if (item.path && isElectron && electronAPI) {
          const meta = await electronAPI.extractMetadata(item.path);
          metadata = {
            title: toTitleCase(meta.title),
            artist: toTitleCase(meta.artist),
            album: toTitleCase(meta.album || "Unknown Album"),
            cover: meta.cover,
            duration: meta.duration, // Assuming we update Electron later
          };
        } else if (item.file) {
          const meta = await extractMetadata(item.file);
          
          // Helper to get duration since jsmediatags doesn't provide it
          const getDuration = (): Promise<number> => {
            return new Promise((resolve) => {
              const audio = new Audio();
              audio.src = URL.createObjectURL(item.file!);
              audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
              };
              audio.onerror = () => resolve(0);
            });
          };
          
          const duration = await getDuration();

          metadata = {
            title: toTitleCase(meta.title),
            artist: toTitleCase(meta.artist),
            album: toTitleCase(meta.album || "Unknown Album"),
            cover: meta.cover,
            duration: duration,
          };
        } else {
          metadata = {
            title: toTitleCase(item.name.replace(/\.[^/.]+$/, "")),
            artist: "Unknown Artist",
            album: "Unknown Album",
          };
        }

        updatedItems[i] = { ...item, metadata };
      } catch (e) {
        console.error("Error loading metadata for", item.name, e);
        updatedItems[i] = {
          ...item,
          metadata: {
            title: toTitleCase(item.name.replace(/\.[^/.]+$/, "")),
            artist: "Unknown Artist",
            album: "Unknown Album",
          },
        };
      }
    }

    setPlaylistItems(updatedItems);
    setMetadataLoaded(true);
    
    // START: Persistence Hook
    // Save the fully loaded metadata (including newly extracted ones) to persistent store
    if (isElectron) {
       const electronAPI = (window as any).electronAPI;
       if (electronAPI) {
          console.log("Saving updated metadata to storage...");
          electronAPI.savePlaylist(updatedItems);
       }
    }
    // END: Persistence Hook
  };

  // Compute albums from playlist items with metadata
  const albums = useMemo<AlbumInfo[]>(() => {
    const albumMap = new Map<string, AlbumInfo>();

    playlistItems.forEach((item, idx) => {
      if (!item.metadata) return;
      const albumName = toTitleCase(item.metadata.album || "Unknown Album");
      const artistName = toTitleCase(item.metadata.artist || "Unknown Artist");
      const key = `${albumName}__${artistName}`;

      if (albumMap.has(key)) {
        albumMap.get(key)!.trackIndices.push(idx);
      } else {
        albumMap.set(key, {
          name: albumName,
          artist: artistName,
          cover: item.metadata.cover,
          trackIndices: [idx],
        });
      }
    });

    return Array.from(albumMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [playlistItems]);

  // Compute artists from playlist items with metadata
  const artists = useMemo<ArtistInfo[]>(() => {
    const artistMap = new Map<string, ArtistInfo>();
    const artistAlbums = new Map<string, Set<string>>();

    playlistItems.forEach((item, idx) => {
      if (!item.metadata) return;
      const artistName = toTitleCase(item.metadata.artist || "Unknown Artist");

      if (artistMap.has(artistName)) {
        artistMap.get(artistName)!.trackIndices.push(idx);
        artistAlbums
          .get(artistName)!
          .add(toTitleCase(item.metadata.album || "Unknown Album"));
      } else {
        artistMap.set(artistName, {
          name: artistName,
          cover: item.metadata.cover,
          trackIndices: [idx],
          albumCount: 1,
        });
        artistAlbums.set(
          artistName,
          new Set([toTitleCase(item.metadata.album || "Unknown Album")])
        );
      }
    });

    // Update album count
    artistMap.forEach((artist, name) => {
      artist.albumCount = artistAlbums.get(name)?.size || 1;
    });

    return Array.from(artistMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [playlistItems]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Get file path for Electron persistence
    const filePath = (file as any).path || "";

    const items: PlaylistItem[] = [
      {
        file,
        path: filePath,
        name: file.name,
      },
    ];

    setPlaylistItems(items);
    setState((prev) => ({
      ...prev,
      playlist: [file],
      currentSongIndex: 0,
    }));

    // Save to Electron storage
    const electronAPI = (window as any).electronAPI;
    if (isElectron && electronAPI && filePath) {
      await electronAPI.savePlaylist([filePath]);
    }

    await playSongFromItem(items[0], 0);
    onImportComplete?.();
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const audioFiles: File[] = Array.from(files).filter(
      (file): file is File =>
        file instanceof File && file.type.startsWith("audio/")
    );
    if (audioFiles.length === 0) return;

    // Create playlist items with paths
    const items: PlaylistItem[] = audioFiles.map((file: File) => ({
      file,
      path: (file as any).path || "",
      name: file.name,
    }));

    setPlaylistItems(items);
    setState((prev) => ({
      ...prev,
      playlist: audioFiles,
      currentSongIndex: -1,
    }));

    // Save paths to Electron storage
    const electronAPI = (window as any).electronAPI;
    if (isElectron && electronAPI) {
      const paths = items.map((item) => item.path).filter((p) => p);
      if (paths.length > 0) {
        await electronAPI.savePlaylist(paths);
      }
    }

    // Load metadata in background
    loadAllMetadata(items);
    onImportComplete?.();
  };

  // Electron: Open folder using native dialog
  const handleElectronFolderSelect = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    const filePaths = await electronAPI.openFolderDialog();
    if (filePaths.length === 0) return;

    const items: PlaylistItem[] = filePaths.map((p: string) => ({
      path: p,
      name: p.split(/[/\\]/).pop() || p,
    }));

    setPlaylistItems(items);
    setState((prev) => ({
      ...prev,
      playlist: [],
      currentSongIndex: -1,
    }));

    // Save to Electron storage
    await electronAPI.savePlaylist(filePaths);
    // Load metadata in background
    loadAllMetadata(items);
  };

  // Electron: Open file using native dialog
  const handleElectronFileSelect = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    const filePaths = await electronAPI.openFileDialog();
    if (filePaths.length === 0) return;

    const items: PlaylistItem[] = filePaths.map((p: string) => ({
      path: p,
      name: p.split(/[/\\]/).pop() || p,
    }));

    setPlaylistItems(items);
    setState((prev) => ({
      ...prev,
      playlist: [],
      currentSongIndex: 0,
    }));

    // Save to Electron storage
    await electronAPI.savePlaylist(filePaths);

    // Auto play first track
    await playSongFromItem(items[0], 0);
  };

  return {
    playlistItems,
    setPlaylistItems,
    albums,
    artists,
    metadataLoaded,
    hasCheckedSaved,
    handleFileChange,
    handleFolderChange,
    handleElectronFolderSelect,
    handleElectronFileSelect,
    loadAllMetadata,
    toTitleCase
  };
};
