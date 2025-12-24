
import { useState, useMemo, useEffect, useTransition } from "react";
import { 
  PlaylistItem, 
  AlbumInfo, 
  ArtistInfo, 
  PlaylistItemMetadata,
  SongState
} from "../types";
import { extractMetadata } from "../../services/metadataService";
import { getDesktopAPI } from "../../services/tauriService";

// Helper to check if running in Desktop environment (Electron or Tauri)
const isDesktop = () => !!(window as any).electronAPI || '__TAURI__' in window;

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
      const desktopAPI = getDesktopAPI();
      if (!isDesktop() || !desktopAPI) {
        setHasCheckedSaved(true);
        return;
      }

      try {
        const savedItems = await desktopAPI.getPlaylist();
        
        if (savedItems && savedItems.length > 0) {
          const items: PlaylistItem[] = [];
          
          for (const item of savedItems) {
            // Normalize legacy string paths to objects
            const path = typeof item === 'string' ? item : (item as any).path;
            
            // Verify file still exists
            const exists = await desktopAPI.fileExists(path);
            if (exists) {
              if (typeof item === 'string') {
                items.push({
                  path: item,
                  name: item.split(/[/\\]/).pop() || item,
                });
              } else {
                 // Restore persisted metadata
                 items.push(item as PlaylistItem);
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
        const desktopAPI = getDesktopAPI();

        if (item.path && isDesktop() && desktopAPI) {
          const meta = await desktopAPI.extractMetadata(item.path);
          metadata = {
            title: toTitleCase(meta.title),
            artist: toTitleCase(meta.artist),
            album: toTitleCase(meta.album || "Unknown Album"),
            cover: meta.cover,
            duration: meta.duration,
            year: (meta as any).year,
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
            year: meta.year,
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
    if (isDesktop()) {
       const desktopAPI = getDesktopAPI();
       if (desktopAPI) {
          console.log("Saving updated metadata to storage...");
          desktopAPI.savePlaylist(updatedItems);
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
        // Update year if not set and current track has year
        if (!albumMap.get(key)!.year && item.metadata.year) {
          albumMap.get(key)!.year = item.metadata.year;
        }
      } else {
        albumMap.set(key, {
          name: albumName,
          artist: artistName,
          cover: item.metadata.cover,
          trackIndices: [idx],
          year: item.metadata.year,
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

    // Save to Desktop storage
    const desktopAPI = getDesktopAPI();
    if (isDesktop() && desktopAPI && filePath) {
      await desktopAPI.savePlaylist([filePath]);
    }

    // Load metadata in background
    loadAllMetadata(items);

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

    // Save paths to Desktop storage
    const desktopAPI = getDesktopAPI();
    if (isDesktop() && desktopAPI) {
      const paths = items.map((item) => item.path).filter((p) => p);
      if (paths.length > 0) {
        await desktopAPI.savePlaylist(paths);
      }
    }

    // Load metadata in background
    loadAllMetadata(items);
    onImportComplete?.();
  };

  // Desktop: Open folder using native dialog
  const handleElectronFolderSelect = async () => {
    const desktopAPI = getDesktopAPI();
    if (!desktopAPI) return;

    const filePaths = await desktopAPI.openFolderDialog();
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

    // Save to Desktop storage
    await desktopAPI.savePlaylist(filePaths);
    // Load metadata in background
    loadAllMetadata(items);
  };

  // Desktop: Open file using native dialog
  const handleElectronFileSelect = async () => {
    const desktopAPI = getDesktopAPI();
    if (!desktopAPI) return;

    const filePaths = await desktopAPI.openFileDialog();
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

    // Save to Desktop storage
    await desktopAPI.savePlaylist(filePaths);

    // Load metadata in background
    loadAllMetadata(items);

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
