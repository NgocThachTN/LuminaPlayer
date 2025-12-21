import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useTransition,
} from "react";
import {
  SongState,
  LyricsResult,
  AlbumInfo,
  ArtistInfo,
  PlaylistItemMetadata,
} from "./types";
import { getLyrics } from "./services/geminiService";
import { extractMetadata, resolveITunesCoverUrl } from "./services/metadataService";
import { Visualizer } from "./components/Visualizer";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { LazyImage } from "./components/LazyImage";

const emptyLyrics: LyricsResult = { synced: [], plain: [], isSynced: false };

// Helper to check if running in Electron
const isElectron = !!window.electronAPI;

// View mode types
type ViewMode =
  | "lyrics"
  | "playlist"
  | "albums"
  | "artists"
  | "album-detail"
  | "artist-detail";

// Playlist item can be File (web) or path string (Electron saved)
interface PlaylistItem {
  file?: File;
  path?: string;
  name: string;
  metadata?: PlaylistItemMetadata;
}

const App: React.FC = () => {
  const [state, setState] = useState<SongState>({
    file: null,
    url: "",
    metadata: { title: "READY TO PLAY", artist: "SELECT A TRACK" },
    lyrics: emptyLyrics,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playlist: [],
    currentSongIndex: -1,
  });

  // Extended playlist with paths for Electron persistence
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("lyrics");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isViewReady, setIsViewReady] = useState(true);
  const [deferredViewMode, setDeferredViewMode] = useState<ViewMode>("lyrics");
  const [isLdacSupported, setIsLdacSupported] = useState(false);

  // Sync deferred view mode with actual view mode (with slight delay for smooth transition)
  useEffect(() => {
    if (viewMode !== deferredViewMode) {
      const timer = setTimeout(() => setDeferredViewMode(viewMode), 10);
      return () => clearTimeout(timer);
    }
  }, [viewMode, deferredViewMode]);
  const [audioInfo, setAudioInfo] = useState<{
    format: string;
    bitrate: number | null;
  }>({
    format: "",
    bitrate: null,
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const playlistContainerRef = useRef<HTMLDivElement>(null);
  const albumsContainerRef = useRef<HTMLDivElement>(null);
  const artistsContainerRef = useRef<HTMLDivElement>(null);
  const albumDetailContainerRef = useRef<HTMLDivElement>(null);
  const artistDetailContainerRef = useRef<HTMLDivElement>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Get current song's album key
  const currentSongAlbumKey = useMemo(() => {
    if (state.currentSongIndex < 0) return null;
    const item = playlistItems[state.currentSongIndex];
    if (!item?.metadata) return null;
    return `${item.metadata.album || "Unknown Album"}__${item.metadata.artist}`;
  }, [state.currentSongIndex, playlistItems]);

  // Get current song's artist name
  const currentSongArtist = useMemo(() => {
    if (state.currentSongIndex < 0) return null;
    const item = playlistItems[state.currentSongIndex];
    return item?.metadata?.artist || null;
  }, [state.currentSongIndex, playlistItems]);

  // Open playlist
  const openPlaylist = () => {
    startTransition(() => setViewMode("playlist"));
  };

  // Compute albums from playlist items with metadata
  const albums = useMemo<AlbumInfo[]>(() => {
    const albumMap = new Map<string, AlbumInfo>();

    playlistItems.forEach((item, idx) => {
      if (!item.metadata) return;
      const albumName = item.metadata.album || "Unknown Album";
      const key = `${albumName}__${item.metadata.artist}`;

      if (albumMap.has(key)) {
        albumMap.get(key)!.trackIndices.push(idx);
      } else {
        albumMap.set(key, {
          name: albumName,
          artist: item.metadata.artist,
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
      const artistName = item.metadata.artist || "Unknown Artist";

      if (artistMap.has(artistName)) {
        artistMap.get(artistName)!.trackIndices.push(idx);
        artistAlbums
          .get(artistName)!
          .add(item.metadata.album || "Unknown Album");
      } else {
        artistMap.set(artistName, {
          name: artistName,
          cover: item.metadata.cover,
          trackIndices: [idx],
          albumCount: 1,
        });
        artistAlbums.set(
          artistName,
          new Set([item.metadata.album || "Unknown Album"])
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

  // Get tracks for selected album
  const selectedAlbumTracks = useMemo(() => {
    if (!selectedAlbum) return [];
    const album = albums.find(
      (a) => `${a.name}__${a.artist}` === selectedAlbum
    );
    if (!album) return [];
    return album.trackIndices.map((idx) => ({ item: playlistItems[idx], idx }));
  }, [selectedAlbum, albums, playlistItems]);

  // Get tracks for selected artist
  const selectedArtistTracks = useMemo(() => {
    if (!selectedArtist) return [];
    const artist = artists.find((a) => a.name === selectedArtist);
    if (!artist) return [];
    return artist.trackIndices.map((idx) => ({
      item: playlistItems[idx],
      idx,
    }));
  }, [selectedArtist, artists, playlistItems]);

  // Get selected album info for header (avoid recalculating in render)
  const selectedAlbumInfo = useMemo(() => {
    if (!selectedAlbum) return null;
    return (
      albums.find((a) => `${a.name}__${a.artist}` === selectedAlbum) || null
    );
  }, [selectedAlbum, albums]);

  // Get selected artist info for header (avoid recalculating in render)
  const selectedArtistInfo = useMemo(() => {
    if (!selectedArtist) return null;
    return artists.find((a) => a.name === selectedArtist) || null;
  }, [selectedArtist, artists]);

  // Load metadata for all tracks (for album/artist grouping)
  const loadAllMetadata = async (items: PlaylistItem[]) => {
    setMetadataLoaded(false);
    const updatedItems = [...items];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.metadata) continue;

      try {
        let metadata: PlaylistItemMetadata;

        if (item.path && isElectron && window.electronAPI) {
          const meta = await window.electronAPI.extractMetadata(item.path);
          metadata = {
            title: meta.title,
            artist: meta.artist,
            album: meta.album || "Unknown Album",
            cover: meta.cover,
          };
        } else if (item.file) {
          const meta = await extractMetadata(item.file);
          metadata = {
            title: meta.title,
            artist: meta.artist,
            album: meta.album || "Unknown Album",
            cover: meta.cover,
          };
        } else {
          metadata = {
            title: item.name.replace(/\.[^/.]+$/, ""),
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
            title: item.name.replace(/\.[^/.]+$/, ""),
            artist: "Unknown Artist",
            album: "Unknown Album",
          },
        };
      }
    }

    setPlaylistItems(updatedItems);
    setMetadataLoaded(true);
  };

  // Scroll to current song when playlist opens (deferred for smooth transition)
  useEffect(() => {
    if (viewMode === "playlist" && state.currentSongIndex >= 0) {
      requestAnimationFrame(() => {
        if (!playlistContainerRef.current) return;
        const currentItem = playlistContainerRef.current.children[
          state.currentSongIndex
        ] as HTMLElement;
        if (currentItem) {
          currentItem.scrollIntoView({ behavior: "instant", block: "center" });
        }
      });
    }
  }, [viewMode]);

  // Scroll to current album when albums view opens (deferred for smooth transition)
  useEffect(() => {
    if (viewMode === "albums" && currentSongAlbumKey) {
      requestAnimationFrame(() => {
        if (!albumsContainerRef.current) return;
        const albumIndex = albums.findIndex(
          (a) => `${a.name}__${a.artist}` === currentSongAlbumKey
        );
        if (albumIndex >= 0) {
          const albumElement = albumsContainerRef.current.children[
            albumIndex
          ] as HTMLElement;
          if (albumElement) {
            albumElement.scrollIntoView({
              behavior: "instant",
              block: "center",
            });
          }
        }
      });
    }
  }, [viewMode, currentSongAlbumKey, albums]);

  // Scroll to current artist when artists view opens (deferred for smooth transition)
  useEffect(() => {
    if (viewMode === "artists" && currentSongArtist) {
      requestAnimationFrame(() => {
        if (!artistsContainerRef.current) return;
        const artistIndex = artists.findIndex(
          (a) => a.name === currentSongArtist
        );
        if (artistIndex >= 0) {
          const artistElement = artistsContainerRef.current.children[
            artistIndex
          ] as HTMLElement;
          if (artistElement) {
            artistElement.scrollIntoView({
              behavior: "instant",
              block: "center",
            });
          }
        }
      });
    }
  }, [viewMode, currentSongArtist, artists]);

  // Scroll to current song in album detail view (deferred for smooth transition)
  useEffect(() => {
    if (viewMode === "album-detail" && state.currentSongIndex >= 0) {
      requestAnimationFrame(() => {
        if (!albumDetailContainerRef.current) return;
        const trackIndex = selectedAlbumTracks.findIndex(
          ({ idx }) => idx === state.currentSongIndex
        );
        if (trackIndex >= 0) {
          const trackElement = albumDetailContainerRef.current.children[
            trackIndex
          ] as HTMLElement;
          if (trackElement) {
            trackElement.scrollIntoView({
              behavior: "instant",
              block: "center",
            });
          }
        }
      });
    }
  }, [viewMode, selectedAlbum, state.currentSongIndex, selectedAlbumTracks]);

  // Scroll to current song in artist detail view (deferred for smooth transition)
  useEffect(() => {
    if (viewMode === "artist-detail" && state.currentSongIndex >= 0) {
      requestAnimationFrame(() => {
        if (!artistDetailContainerRef.current) return;
        const trackIndex = selectedArtistTracks.findIndex(
          ({ idx }) => idx === state.currentSongIndex
        );
        if (trackIndex >= 0) {
          const trackElement = artistDetailContainerRef.current.children[
            trackIndex
          ] as HTMLElement;
          if (trackElement) {
            trackElement.scrollIntoView({
              behavior: "instant",
              block: "center",
            });
          }
        }
      });
    }
  }, [viewMode, selectedArtist, state.currentSongIndex, selectedArtistTracks]);

  // Load saved playlist on startup (Electron only)
  useEffect(() => {
    const loadSavedPlaylist = async () => {
      if (!isElectron || !window.electronAPI) return;

      try {
        const savedPaths = await window.electronAPI.getPlaylist();
        if (savedPaths && savedPaths.length > 0) {
          // Filter out paths that no longer exist
          const validPaths: string[] = [];
          for (const p of savedPaths) {
            const exists = await window.electronAPI.fileExists(p);
            if (exists) validPaths.push(p);
          }

          if (validPaths.length > 0) {
            const items: PlaylistItem[] = validPaths.map((p) => ({
              path: p,
              name: p.split(/[/\\]/).pop() || p,
            }));
            setPlaylistItems(items);
            setViewMode("playlist");
            // Load metadata in background
            loadAllMetadata(items);
          }
        }
      } catch (e) {
        console.error("Error loading saved playlist:", e);
      }
    };

    loadSavedPlaylist();
    loadSavedPlaylist();
  }, []);

  // Check LDAC Support (Poll every 3 seconds to detect connection changes)
  useEffect(() => {
    let intervalId: any;
    
    const checkLdac = async () => {
      // Avoid checking if window/electronAPI is missing
      if (isElectron && window.electronAPI && window.electronAPI.checkLdacSupport) {
        const supported = await window.electronAPI.checkLdacSupport();
        // Only update if changed to avoid renders
        setIsLdacSupported(prev => prev !== supported ? supported : prev);
      }
    };

    // Check immediately
    checkLdac();
    
    // Poll for device connection status
    if (isElectron) {
      intervalId = setInterval(checkLdac, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

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
    if (isElectron && window.electronAPI && filePath) {
      await window.electronAPI.savePlaylist([filePath]);
    }

    await playSongFromItem(items[0], 0);
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
    if (isElectron && window.electronAPI) {
      const paths = items.map((item) => item.path).filter((p) => p);
      if (paths.length > 0) {
        await window.electronAPI.savePlaylist(paths);
      }
    }

    setViewMode("playlist");
    // Load metadata in background
    loadAllMetadata(items);
  };

  // Electron: Open folder using native dialog
  const handleElectronFolderSelect = async () => {
    if (!window.electronAPI) return;

    const filePaths = await window.electronAPI.openFolderDialog();
    if (filePaths.length === 0) return;

    const items: PlaylistItem[] = filePaths.map((p) => ({
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
    await window.electronAPI.savePlaylist(filePaths);
    setViewMode("playlist");
    // Load metadata in background
    loadAllMetadata(items);
  };

  // Electron: Open file using native dialog
  const handleElectronFileSelect = async () => {
    if (!window.electronAPI) return;

    const filePaths = await window.electronAPI.openFileDialog();
    if (filePaths.length === 0) return;

    const items: PlaylistItem[] = filePaths.map((p) => ({
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
    await window.electronAPI.savePlaylist(filePaths);

    // Auto play first track
    await playSongFromItem(items[0], 0);
  };

  // Get audio format from filename
  const getAudioFormat = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const formatMap: { [key: string]: string } = {
      flac: "FLAC",
      mp3: "MP3",
      wav: "WAV",
      aac: "AAC",
      m4a: "M4A",
      ogg: "OGG",
      wma: "WMA",
      aiff: "AIFF",
      alac: "ALAC",
      opus: "OPUS",
    };
    return formatMap[ext] || ext.toUpperCase();
  };

  // Play from playlist item (supports both File and path)
  const playSongFromItem = async (item: PlaylistItem, index: number) => {
    setActiveLyricIndex(-1);

    // Scroll lyrics về đầu trang
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
    }

    // Get format from filename
    const format = getAudioFormat(item.name);
    setAudioInfo({ format, bitrate: null });

    let url = "";
    let file: File | null = null;
    let fileSize: number | null = null;
    let metadataTitle = item.name.replace(/\.[^/.]+$/, "");
    let metadataArtist = "Unknown Artist";

    // If we have a File object, use it
    if (item.file) {
      file = item.file;
      fileSize = file.size;
      url = URL.createObjectURL(file);
    }
    // If we only have path (Electron), use file:// protocol directly - MUCH faster!
    else if (item.path && isElectron) {
      // Use file:// protocol directly for instant playback
      url = `file://${item.path.replace(/\\/g, "/")}`;

      // Get basic metadata from filename
      if (window.electronAPI) {
        const info = await window.electronAPI.getFileInfo(item.path);
        metadataTitle = info.title;
        metadataArtist = info.artist;
        fileSize = info.size || null;
      }
    }

    // Calculate bitrate when audio is loaded
    const calculateBitrate = (duration: number) => {
      if (fileSize && duration > 0) {
        const bitrate = Math.round((fileSize * 8) / duration / 1000);
        setAudioInfo((prev) => ({ ...prev, bitrate }));
      }
    };

    // Store calculateBitrate for use in onLoadedMetadata
    (window as any).__calculateBitrate = calculateBitrate;

    if (!url) {
      console.error("Could not load audio file");
      return;
    }

    // Start playing IMMEDIATELY with basic metadata (keep old cover to avoid flash)
    setState((prev) => ({
      ...prev,
      file,
      url,
      metadata: {
        title: metadataTitle,
        artist: metadataArtist,
        cover: prev.metadata.cover, // Keep old cover until new one loads
      },
      lyrics: emptyLyrics,
      isPlaying: true,
      currentTime: 0,
      currentSongIndex: index,
    }));

    // Save current index to Electron storage (don't await)
    if (isElectron && window.electronAPI) {
      window.electronAPI.saveCurrentIndex(index);
    }

    // Load full metadata in background (FAST - only reads metadata, not entire file)
    setIsLoading(true);

    const loadMetadataAndLyrics = async () => {
      let finalTitle = metadataTitle;
      let finalArtist = metadataArtist;
      let finalMetadata = {
        title: metadataTitle,
        artist: metadataArtist,
        cover: undefined as string | undefined,
      };

      // Extract metadata - use Electron IPC for path, or browser API for File
      try {
        if (item.path && isElectron && window.electronAPI) {
          // Electron: Use IPC to extract metadata directly from file (FAST - only reads metadata bytes)
          const metadata = await window.electronAPI.extractMetadata(item.path);
          finalTitle = metadata.title;
          finalArtist = metadata.artist;
          finalMetadata = metadata;
        } else if (file) {
          // Browser: Use jsmediatags on File object
          const metadata = await extractMetadata(file);
          finalTitle = metadata.title;
          finalArtist = metadata.artist;
          finalMetadata = metadata;
        }
      } catch (e) {
        console.error("Error extracting metadata:", e);
      }

      // Update metadata IMMEDIATELY (only if still same song)
      setState((prev) => {
        if (prev.currentSongIndex === index) {
          return { ...prev, metadata: finalMetadata };
        }
        return prev;
      });

      // Now load lyrics with correct title/artist (this can be slow, but metadata is already shown)
      try {
        const lyrics = await getLyrics(finalTitle, finalArtist);
        setState((prev) => {
          if (prev.currentSongIndex === index) {
            return { ...prev, lyrics };
          }
          return prev;
        });
      } catch (e) {
        console.error("Error loading lyrics:", e);
      }

      setIsLoading(false);
    };

    // Run in background - don't block playback
    loadMetadataAndLyrics();
  };

  // Legacy playSong for backward compatibility
  const playSong = async (file: File, index: number) => {
    const item: PlaylistItem = {
      file,
      path: (file as any).path || "",
      name: file.name,
    };
    await playSongFromItem(item, index);
  };

  const handleSongSelect = (index: number) => {
    if (playlistItems[index]) {
      playSongFromItem(playlistItems[index], index);
    } else if (state.playlist[index]) {
      playSong(state.playlist[index], index);
    }
    setViewMode("lyrics"); // Chuyển sang tab Lyrics sau khi chọn bài
  };

  const playNext = () => {
    const totalTracks = playlistItems.length || state.playlist.length;
    if (state.currentSongIndex < totalTracks - 1) {
      handleSongSelect(state.currentSongIndex + 1);
    } else {
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const playPrevious = () => {
    const totalTracks = playlistItems.length || state.playlist.length;
    // Nếu đang phát > 3 giây thì quay về đầu bài, không thì chuyển bài trước
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setState((prev) => ({ ...prev, currentTime: 0 }));
    } else if (state.currentSongIndex > 0) {
      handleSongSelect(state.currentSongIndex - 1);
    } else {
      // Ở bài đầu tiên thì quay về đầu
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setState((prev) => ({ ...prev, currentTime: 0 }));
      }
    }
  };

  // Scroll lyrics về đầu khi chuyển bài
  useEffect(() => {
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
    }
    setActiveLyricIndex(-1);
    lastScrollTimeRef.current = 0;
  }, [state.currentSongIndex]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.isPlaying && audioRef.current) {
      audioRef.current.play().catch((e) => console.error("Playback failed", e));
    }
  }, [state.url, state.isPlaying]);

  // Update Discord Rich Presence - only when song/state changes
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.updateDiscordPresence) return;

    const audio = audioRef.current;
    
    // 1. Initial immediate update (default icon)
    window.electronAPI.updateDiscordPresence({
      title: state.metadata.title,
      artist: state.metadata.artist,
      isPlaying: state.isPlaying,
      currentTime: audio?.currentTime || 0,
      duration: audio?.duration || state.duration,
    });
    
    // 2. Async fetch for Cover Art (public URL for Discord)
    if (state.metadata.title && state.metadata.artist !== "Unknown Artist") {
       resolveITunesCoverUrl(state.metadata.title, state.metadata.artist).then(url => {
         if (url) {
            // Update again with specific cover
            window.electronAPI!.updateDiscordPresence({
              title: state.metadata.title,
              artist: state.metadata.artist,
              isPlaying: state.isPlaying,
              currentTime: audio?.currentTime || 0,
              duration: audio?.duration || state.duration,
              cover: url
            });
         }
       });
    }

  }, [
    state.metadata.title,
    state.metadata.artist,
    state.isPlaying,
    state.currentSongIndex,
  ]);

  // Clear Discord presence on unmount
  useEffect(() => {
    return () => {
      if (isElectron && window.electronAPI?.clearDiscordPresence) {
        window.electronAPI.clearDiscordPresence();
      }
    };
  }, []);

  // Optimized lyric tracking with debounced scroll (only for synced lyrics)
  useEffect(() => {
    if (!state.lyrics.isSynced || state.lyrics.synced.length === 0) return;

    // Add small offset (200ms ahead) so lyrics feel more in sync
    const currentTime = state.currentTime + 0.2;
    const index = state.lyrics.synced.findLastIndex(
      (l) => l.time <= currentTime
    );

    if (index !== activeLyricIndex && index >= 0) {
      setActiveLyricIndex(index);

      // Debounce scroll to avoid excessive calls
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 100) {
        lastScrollTimeRef.current = now;

        if (scrollTimeoutRef.current) {
          cancelAnimationFrame(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = requestAnimationFrame(() => {
          if (lyricsContainerRef.current) {
            const activeElement = lyricsContainerRef.current.children[
              index
            ] as HTMLElement;
            if (activeElement) {
              const container = lyricsContainerRef.current;
              const containerHeight = container.clientHeight;
              const elementTop = activeElement.offsetTop;
              const elementHeight = activeElement.clientHeight;
              const targetScroll =
                elementTop - containerHeight / 2 + elementHeight / 2;

              container.scrollTo({
                top: targetScroll,
                behavior: "smooth",
              });
            }
          }
        });
      }
    }
  }, [state.currentTime, state.lyrics, activeLyricIndex]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    state.isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const hasLyrics =
    state.lyrics.synced.length > 0 || state.lyrics.plain.length > 0;

  return (
    <div className="h-screen w-full flex flex-col bg-black text-white overflow-hidden app-bg">
      {/* Top Border Navigation */}
      <header className="glass-header w-full flex justify-between items-center border-b border-white/10 px-6 py-3 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-wide text-white/80 hidden sm:inline">
            Lumina
          </span>
        </div>

        <div className="flex items-center gap-0">
          <button
            onClick={() => startTransition(() => setViewMode("lyrics"))}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${
              viewMode === "lyrics"
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Lyrics
          </button>
          <button
            onClick={openPlaylist}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${
              viewMode === "playlist"
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Playlist
          </button>
          <button
            onClick={() => {
              // Show loading immediately, then switch view
              setIsViewReady(false);
              if (currentSongAlbumKey) {
                setSelectedAlbum(currentSongAlbumKey);
                setViewMode("album-detail");
              } else {
                setSelectedAlbum(null);
                setViewMode("albums");
              }
              // Mark view as ready after render
              requestAnimationFrame(() => setIsViewReady(true));
            }}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${
              viewMode === "albums" || viewMode === "album-detail"
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Albums
          </button>
          <button
            onClick={() => {
              // Show loading immediately, then switch view
              setIsViewReady(false);
              if (currentSongArtist) {
                setSelectedArtist(currentSongArtist);
                setViewMode("artist-detail");
              } else {
                setSelectedArtist(null);
                setViewMode("artists");
              }
              // Mark view as ready after render
              requestAnimationFrame(() => setIsViewReady(true));
            }}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${
              viewMode === "artists" || viewMode === "artist-detail"
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Artists
          </button>
          {isElectron ? (
            <button
              onClick={handleElectronFolderSelect}
              className="square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10"
            >
              Import Folder
            </button>
          ) : (
            <label className="square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10">
              Import Folder
              <input
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleFolderChange}
              />
            </label>
          )}
          {isElectron ? (
            <button
              onClick={handleElectronFileSelect}
              className="square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10"
            >
              Import Track
            </button>
          ) : (
            <label className="square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10">
              Import Track
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="square-btn px-4 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Grid Content Area */}
      <main className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        {/* Left Section: Information Grid */}
        <div className="w-full md:w-[40%] flex flex-col border-r border-white/10 overflow-y-auto hide-scrollbar">
          {/* Album Cover Container - Fixed aspect ratio */}
          <div className="w-full p-8 flex items-center justify-center">
            <div className="album-cover-container relative">
              {/* Vinyl record effect */}
              <div
                className={`vinyl-record ${
                  state.isPlaying ? "vinyl-spinning" : ""
                }`}
              ></div>

              {/* Album cover */}
              <div className="album-cover aspect-square w-full max-w-[320px] bg-neutral-900 rounded-md overflow-hidden flex items-center justify-center">
                {state.metadata.cover ? (
                  <img
                    src={state.metadata.cover}
                    className="w-full h-full object-contain"
                    alt="Cover Art"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                    <svg
                      className="w-16 h-16 text-white/10"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Song Info - Centered below cover */}
          <div className="px-6 pb-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight tracking-tight line-clamp-2">
              {state.metadata.title}
            </h2>
            <p className="text-white/50 text-sm font-medium uppercase tracking-[0.15em]">
              {state.metadata.artist}
            </p>
          </div>

          {/* Visualizer */}
          <div className="px-6 pb-6 mt-auto">
            <Visualizer
              audioElement={audioRef.current}
              isPlaying={state.isPlaying}
            />
          </div>
        </div>

        {/* Right Section: Lyrics List or Playlist or Albums or Artists */}
        <div className="w-full md:w-[60%] relative flex flex-col bg-black">
          {viewMode === "playlist" ? (
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">
                  Playlist ({playlistItems.length || state.playlist.length})
                </h3>
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                <div ref={playlistContainerRef} className="flex flex-col gap-2">
                  {(playlistItems.length > 0
                    ? playlistItems
                    : state.playlist.map((f) => ({ file: f, name: f.name }))
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSongSelect(idx)}
                      className={`playlist-item virtual-list-item p-4 rounded-lg cursor-pointer flex items-center gap-4 ${
                        idx === state.currentSongIndex ? "active" : ""
                      }`}
                    >
                      <span className="text-xs font-mono text-white/30 w-6">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium tracking-wide truncate flex-1">
                        {item.metadata?.title ||
                          item.name.replace(/\.[^/.]+$/, "")}
                      </span>
                      {item.metadata && (
                        <span className="text-xs text-white/30 truncate max-w-[120px]">
                          {item.metadata.artist}
                        </span>
                      )}
                      {idx === state.currentSongIndex && (
                        <div className="playing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  ))}
                  {playlistItems.length === 0 &&
                    state.playlist.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <svg
                          className="w-16 h-16 text-white/10"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                        <p className="text-white/20 text-sm uppercase tracking-widest">
                          No tracks in playlist
                        </p>
                        <p className="text-white/10 text-xs">
                          Import a folder or track to get started
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : viewMode === "albums" ? (
            // Albums Grid View
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">
                  Albums ({albums.length})
                </h3>
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                {!metadataLoaded && playlistItems.length > 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="loading-spinner"></div>
                    <p className="text-white/40 text-sm uppercase tracking-widest">
                      Loading metadata...
                    </p>
                  </div>
                ) : albums.length > 0 ? (
                  <div ref={albumsContainerRef} className="album-grid">
                    {albums.map((album) => {
                      const albumKey = `${album.name}__${album.artist}`;
                      const isCurrentAlbum = albumKey === currentSongAlbumKey;
                      return (
                        <div
                          key={albumKey}
                          onClick={() => {
                            setSelectedAlbum(albumKey);
                            setViewMode("album-detail");
                          }}
                          className={`album-card cursor-pointer group ${
                            isCurrentAlbum ? "album-playing" : ""
                          }`}
                        >
                          <div className="album-card-cover">
                            {album.cover ? (
                              <LazyImage
                                src={album.cover}
                                alt={album.name}
                                className="w-full h-full object-cover"
                                placeholderClassName="w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                                <svg
                                  className="w-12 h-12 text-white/20"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                </svg>
                              </div>
                            )}
                            <div className="album-card-overlay">
                              <svg
                                className="w-12 h-12 text-white"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                          <div className="mt-3 px-1">
                            <p className="text-sm font-medium truncate text-white/90">
                              {album.name}
                            </p>
                            <p className="text-xs text-white/40 truncate mt-0.5">
                              {album.artist}
                            </p>
                            <p className="text-xs text-white/30 mt-1">
                              {album.trackIndices.length} tracks
                            </p>
                          </div>
                          {isCurrentAlbum && (
                            <div className="absolute top-2 right-2 playing-indicator">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <svg
                      className="w-16 h-16 text-white/10"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <p className="text-white/20 text-sm uppercase tracking-widest">
                      No albums found
                    </p>
                    <p className="text-white/10 text-xs">
                      Import music to see albums
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === "album-detail" && selectedAlbum ? (
            // Album Detail View
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <button
                  onClick={() => {
                    setIsViewReady(false);
                    setViewMode("albums");
                    requestAnimationFrame(() => setIsViewReady(true));
                  }}
                  className="text-xs text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-2 mb-3"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to Albums
                </button>
                {selectedAlbumInfo && (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                      {selectedAlbumInfo.cover ? (
                        <img
                          src={selectedAlbumInfo.cover}
                          alt={selectedAlbumInfo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                          <svg
                            className="w-6 h-6 text-white/20"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedAlbumInfo.name}
                      </h3>
                      <p className="text-sm text-white/50">
                        {selectedAlbumInfo.artist} •{" "}
                        {selectedAlbumInfo.trackIndices.length} tracks
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                <div
                  ref={albumDetailContainerRef}
                  className="flex flex-col gap-2"
                >
                  {selectedAlbumTracks.map(({ item, idx }, i) => (
                    <div
                      key={idx}
                      onClick={() => handleSongSelect(idx)}
                      className={`playlist-item virtual-list-item p-4 rounded-lg cursor-pointer flex items-center gap-4 ${
                        idx === state.currentSongIndex ? "active" : ""
                      }`}
                    >
                      <span className="text-xs font-mono text-white/30 w-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium tracking-wide truncate flex-1">
                        {item.metadata?.title ||
                          item.name.replace(/\.[^/.]+$/, "")}
                      </span>
                      {idx === state.currentSongIndex && (
                        <div className="playing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : viewMode === "artists" ? (
            // Artists List View
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">
                  Artists {isViewReady ? `(${artists.length})` : ""}
                </h3>
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                {!metadataLoaded && playlistItems.length > 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="loading-spinner"></div>
                    <p className="text-white/40 text-sm uppercase tracking-widest">
                      Loading metadata...
                    </p>
                  </div>
                ) : artists.length > 0 ? (
                  <div
                    ref={artistsContainerRef}
                    className="flex flex-col gap-2"
                  >
                    {artists.map((artist) => {
                      const isCurrentArtist = artist.name === currentSongArtist;
                      return (
                        <div
                          key={artist.name}
                          onClick={() => {
                            setSelectedArtist(artist.name);
                            setViewMode("artist-detail");
                          }}
                          className={`artist-item virtual-list-item p-4 rounded-lg cursor-pointer flex items-center gap-4 ${
                            isCurrentArtist ? "active" : ""
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden">
                            {artist.cover ? (
                              <LazyImage
                                src={artist.cover}
                                alt={artist.name}
                                className="w-full h-full object-cover"
                                placeholderClassName="w-full h-full rounded-full"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center">
                                <svg
                                  className="w-5 h-5 text-white/40"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-white/90">
                              {artist.name}
                            </p>
                            <p className="text-xs text-white/40">
                              {artist.albumCount} album
                              {artist.albumCount > 1 ? "s" : ""} •{" "}
                              {artist.trackIndices.length} tracks
                            </p>
                          </div>
                          {isCurrentArtist ? (
                            <div className="playing-indicator">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          ) : (
                            <svg
                              className="w-5 h-5 text-white/20"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <svg
                      className="w-16 h-16 text-white/10"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    <p className="text-white/20 text-sm uppercase tracking-widest">
                      No artists found
                    </p>
                    <p className="text-white/10 text-xs">
                      Import music to see artists
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === "artist-detail" && selectedArtist ? (
            // Artist Detail View
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <button
                  onClick={() => {
                    setIsViewReady(false);
                    setViewMode("artists");
                    requestAnimationFrame(() => setIsViewReady(true));
                  }}
                  className="text-xs text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-2 mb-3"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back to Artists
                </button>
                {selectedArtistInfo && (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-neutral-700 to-neutral-900">
                      {selectedArtistInfo.cover ? (
                        <img
                          src={selectedArtistInfo.cover}
                          alt={selectedArtistInfo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-white/30"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedArtistInfo.name}
                      </h3>
                      <p className="text-sm text-white/50">
                        {selectedArtistInfo.albumCount} album
                        {selectedArtistInfo.albumCount > 1 ? "s" : ""} •{" "}
                        {selectedArtistInfo.trackIndices.length} tracks
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                <div
                  ref={artistDetailContainerRef}
                  className="flex flex-col gap-2"
                >
                  {selectedArtistTracks.map(({ item, idx }, i) => (
                    <div
                      key={idx}
                      onClick={() => handleSongSelect(idx)}
                      className={`playlist-item virtual-list-item p-4 rounded-lg cursor-pointer flex items-center gap-4 ${
                        idx === state.currentSongIndex ? "active" : ""
                      }`}
                    >
                      <span className="text-xs font-mono text-white/30 w-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="w-10 h-10 rounded shrink-0 overflow-hidden">
                        {item.metadata?.cover ? (
                          <LazyImage
                            src={item.metadata.cover}
                            alt=""
                            className="w-full h-full object-cover"
                            placeholderClassName="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-white/20"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium tracking-wide truncate block">
                          {item.metadata?.title ||
                            item.name.replace(/\.[^/.]+$/, "")}
                        </span>
                        <span className="text-xs text-white/40 truncate block">
                          {item.metadata?.album || "Unknown Album"}
                        </span>
                      </div>
                      {idx === state.currentSongIndex && (
                        <div className="playing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-6">
              <div className="loading-spinner"></div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-medium">
                Loading Lyrics
              </p>
            </div>
          ) : state.lyrics.isSynced ? (
            // Synced Lyrics View
            <div
              ref={lyricsContainerRef}
              className="h-full w-full overflow-y-auto lyrics-scroll py-[35vh] px-6 md:px-12"
            >
              {state.lyrics.synced.map((line, idx) => {
                const distance = idx - activeLyricIndex;
                const absDistance = Math.abs(distance);
                const isActive = idx === activeLyricIndex;
                const isNear1 = absDistance === 1;
                const isNear2 = absDistance === 2;
                const isUpcoming = distance > 0 && distance <= 4;

                return (
                  <div
                    key={idx}
                    onClick={() =>
                      audioRef.current &&
                      (audioRef.current.currentTime = line.time)
                    }
                    className={`lyric-item text-lg md:text-2xl cursor-pointer select-none ${
                      isActive ? "active-lyric" : ""
                    } ${isNear1 ? "near-active near-active-1" : ""} ${
                      isNear2 ? "near-active near-active-2" : ""
                    } ${isUpcoming && !isNear1 && !isNear2 ? "upcoming" : ""}`}
                  >
                    {line.text || "♪"}
                  </div>
                );
              })}
            </div>
          ) : hasLyrics ? (
            // Plain Lyrics View
            <div
              ref={lyricsContainerRef}
              className="h-full w-full overflow-y-auto lyrics-scroll py-10 px-6 md:px-12"
            >
              <div className="flex flex-col">
                {state.lyrics.plain.map((line, idx) => (
                  <div
                    key={idx}
                    className="plain-lyric text-base md:text-lg tracking-wide"
                  >
                    {line || <span className="text-white/20">♪</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // No Lyrics
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <svg
                className="w-12 h-12 text-white/10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
              </svg>
              <p className="text-white/20 text-xs uppercase tracking-[0.3em]">
                {state.file ? "No Lyrics Found" : "Select a Track"}
              </p>
            </div>
          )}
          {/* Enhanced Fade Overlays */}
          {viewMode === "lyrics" && hasLyrics && (
            <>
              <div
                className={`absolute top-0 left-0 w-full ${
                  state.lyrics.isSynced ? "h-40" : "h-20"
                } lyrics-fade-top pointer-events-none z-10`}
              ></div>
              <div
                className={`absolute bottom-0 left-0 w-full ${
                  state.lyrics.isSynced ? "h-40" : "h-20"
                } lyrics-fade-bottom pointer-events-none z-10`}
              ></div>
            </>
          )}
        </div>
      </main>

      {/* Control Strip */}
      <footer className="w-full border-t border-white/10 flex flex-col">
        {/* Progress Bar - Optimized */}
        <div className="w-full px-6 py-4 flex items-center gap-4">
          <span className="text-[11px] font-mono text-white/50 w-10 text-right tabular-nums">
            {formatTime(state.currentTime)}
          </span>
          <div className="progress-bar flex-1 h-1 bg-white/10 relative group cursor-pointer rounded-full">
            <div
              className="progress-bar-fill absolute top-0 left-0 h-full rounded-full transition-all duration-75 ease-linear"
              style={{
                width: `${(state.currentTime / state.duration) * 100 || 0}%`,
              }}
            ></div>
            {/* Hover indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: `${(state.currentTime / state.duration) * 100 || 0}%`,
                transform: "translate(-50%, -50%)",
              }}
            ></div>
            <input
              type="range"
              min="0"
              max={state.duration || 0}
              value={state.currentTime}
              onChange={(e) => {
                const time = Number(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = time;
                setState((prev) => ({ ...prev, currentTime: time }));
              }}
              className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-4 opacity-0 cursor-pointer z-10"
            />
          </div>
          <span className="text-[11px] font-mono text-white/50 w-10 tabular-nums">
            {formatTime(state.duration)}
          </span>
        </div>

        <div className="flex w-full items-center border-t border-white/10">
          {/* Playback Controls */}
          <div className="p-4 border-r border-white/10 flex items-center justify-center gap-2">
            {/* Previous Button */}
            <button
              onClick={playPrevious}
              disabled={(playlistItems.length || state.playlist.length) === 0}
              className="square-btn w-10 h-10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="play-btn w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
            >
              {state.isPlaying ? (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 ml-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next Button */}
            <button
              onClick={playNext}
              disabled={(playlistItems.length || state.playlist.length) === 0}
              className="square-btn w-10 h-10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="px-6 flex-1 flex items-center justify-between text-[11px] font-medium tracking-wider text-white/40 uppercase">
            <div className="flex items-center gap-2">
              <span className="text-white/60 tabular-nums">
                {(playlistItems.length || state.playlist.length) > 0
                  ? `${state.currentSongIndex + 1} / ${
                      playlistItems.length || state.playlist.length
                    }`
                  : "—"}
              </span>
              <span className="text-white/20">tracks</span>
            </div>
            <div className="flex items-center gap-3">
              {audioInfo.format && (
                <span className="text-amber-400/80 font-semibold">
                  {audioInfo.format}
                </span>
              )}
              {audioInfo.bitrate && (
                <span className="text-white/40">{audioInfo.bitrate} kbps</span>
              )}
              {state.lyrics.isSynced && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  Synced
                </span>
              )}
              {/* LDAC Indicator - Only if logic verified via AOSP Codec */}
              {isLdacSupported && (
                <div className="flex items-center gap-1 group cursor-help" title="LDAC High Quality Audio Active">
                   <span className="text-[10px] font-bold tracking-widest text-[#ffd700] transition-colors duration-300">LDAC</span>
                </div>
              )}
              <span className="hidden sm:inline text-white/30">
                {state.isPlaying ? "Now Playing" : "Paused"}
              </span>
            </div>
          </div>

          <div className="hidden md:flex border-l border-white/10 items-center px-6 gap-3">
            <svg
              className="w-4 h-4 text-white/40"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              defaultValue="0.8"
              onChange={(e) => {
                if (audioRef.current)
                  audioRef.current.volume = Number(e.target.value);
              }}
              className="w-20 accent-white cursor-pointer"
            />
          </div>
        </div>
      </footer>

      <audio
        ref={audioRef}
        src={state.url}
        onTimeUpdate={() =>
          setState((prev) => ({
            ...prev,
            currentTime: audioRef.current?.currentTime || 0,
          }))
        }
        onLoadedMetadata={() => {
          const duration = audioRef.current?.duration || 0;
          setState((prev) => ({
            ...prev,
            duration,
          }));
          // Calculate bitrate
          if ((window as any).__calculateBitrate) {
            (window as any).__calculateBitrate(duration);
          }
        }}
        onEnded={playNext}
      />

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={() => {}}
      />
    </div>
  );
};

export default App;
