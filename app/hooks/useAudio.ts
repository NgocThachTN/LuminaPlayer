
import { useRef, useEffect } from "react";
import { SongState, PlaylistItem, SongMetadata, LyricsResult } from "../types";
import { getLyrics } from "../../services/geminiService";
import { extractMetadata, resolveITunesCoverUrl } from "../../services/metadataService";

const emptyLyrics: LyricsResult = { synced: [], plain: [], isSynced: false };
const isElectron = !!(window as any).electronAPI;

// Constants
const toTitleCase = (str: string) => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};

export const useAudio = (
  state: SongState,
  setState: React.Dispatch<React.SetStateAction<SongState>>,
  playlistItems: PlaylistItem[], // This is now the QUEUE
  volume: number,
  setAudioInfo: React.Dispatch<React.SetStateAction<{ format: string; bitrate: number | null }>>,
  setIsLoading: (loading: boolean) => void
) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
    // Scroll lyrics to top is handled by useLyrics effect on song change
    
    // Get format from filename
    const format = getAudioFormat(item.name);
    setAudioInfo({ format, bitrate: null });

    let url = "";
    let file: File | null = null;
    let fileSize: number | null = null;
    let metadataTitle = item.name.replace(/\.[^/.]+$/, "");
    let metadataArtist = "Unknown Artist";
    let metadataAlbum = "Unknown Album";

    // If we have a File object, use it
    if (item.file) {
      file = item.file;
      fileSize = file.size;
      url = URL.createObjectURL(file);
    }
    // If we only have path (Electron), use file:// protocol directly
    else if (item.path && isElectron) {
      url = `file://${item.path.replace(/\\/g, "/")}`;

      // Get basic metadata from filename
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        const info = await electronAPI.getFileInfo(item.path);
        metadataTitle = info.title;
        metadataArtist = info.artist;
        fileSize = info.size || null;
      }
    }

    // Use cached metadata if available
    if (item.metadata) {
      metadataTitle = item.metadata.title || metadataTitle;
      metadataArtist = item.metadata.artist || metadataArtist;
      metadataAlbum = item.metadata.album || metadataAlbum;
    } else {
      const filenameBase = item.name.replace(/\.[^/.]+$/, "");
      const parts = filenameBase.split(" - ");
      if (parts.length >= 2) {
           metadataArtist = toTitleCase(parts[0].trim());
           metadataTitle = toTitleCase(parts.slice(1).join(" - ").trim());
      } else {
           metadataTitle = toTitleCase(filenameBase);
      }
    }

    // Calculate bitrate when audio is loaded
    const calculateBitrate = (duration: number) => {
      if (fileSize && duration > 0) {
        const bitrate = Math.round((fileSize * 8) / duration / 1000);
        setAudioInfo((prev: any) => ({ ...prev, bitrate }));
      }
    };

    (window as any).__calculateBitrate = calculateBitrate;

    if (!url) {
      console.error("Could not load audio file");
      return;
    }

    setState((prev) => ({
      ...prev,
      file,
      url,
      metadata: {
        title: metadataTitle,
        artist: metadataArtist,
        album: metadataAlbum,
        cover: item.metadata?.cover || prev.metadata.cover,
      },
      lyrics: emptyLyrics,
      isPlaying: true,
      currentTime: 0,
      currentSongIndex: index,
    }));

     const electronAPI = (window as any).electronAPI;
    if (isElectron && electronAPI) {
      electronAPI.saveCurrentIndex(index);
    }

    setIsLoading(true);

    const loadMetadataAndLyrics = async () => {
      let finalTitle = metadataTitle;
      let finalArtist = metadataArtist;
      let finalMetadata: SongMetadata = {
        title: metadataTitle,
        artist: metadataArtist,
        cover: undefined,
      };

      try {
        if (item.path && isElectron && electronAPI) {
          const metadata = await electronAPI.extractMetadata(item.path);
          finalTitle = toTitleCase(metadata.title);
          finalArtist = toTitleCase(metadata.artist);
          finalMetadata = { ...metadata, title: finalTitle, artist: finalArtist };
        } else if (file) {
          const metadata = await extractMetadata(file);
          finalTitle = toTitleCase(metadata.title);
          finalArtist = toTitleCase(metadata.artist);
          finalMetadata = { ...metadata, title: finalTitle, artist: finalArtist };
        }
      } catch (e) {
        console.error("Error extracting metadata:", e);
      }

      setState((prev) => {
        if (prev.currentSongIndex === index) {
          return { ...prev, metadata: finalMetadata };
        }
        return prev;
      });

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

    loadMetadataAndLyrics();
  };

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
  };

  const playNext = () => {
    const totalTracks = playlistItems.length;
    if (totalTracks === 0) return;

    // Handle Repeat One (Single Song Loop)
    if (state.repeatMode === 'one') {
       if (audioRef.current) {
          // Simply rewind and ensure playing. No complex state toggling needed.
          audioRef.current.currentTime = 0;
          if (!state.isPlaying) {
             audioRef.current.play().catch(e => console.error("Replay failed:", e));
             setState(prev => ({ ...prev, isPlaying: true }));
          } else {
             audioRef.current.play().catch(console.error);
          }
       }
       return;
    }

    let nextIndex = -1;

    // Handle Shuffle
    if (state.isShuffle) {
      // Simple random for now (can be improved with history later)
      do {
        nextIndex = Math.floor(Math.random() * totalTracks);
      } while (nextIndex === state.currentSongIndex && totalTracks > 1);
    } else {
      // Normal Sequence
      nextIndex = state.currentSongIndex + 1;
    }

    // Handle Boundary & Repeat All
    if (nextIndex >= totalTracks) {
       if (state.repeatMode === 'all') {
         nextIndex = 0;
       } else {
         // Stop playback
         setState((prev) => ({ ...prev, isPlaying: false }));
         return;
       }
    }

    // Optimization: If the next song is the SAME as the current song (e.g. 1 song list + Repeat All),
    // just replay it directly to avoid state update redundancy/rendering issues.
    if (nextIndex === state.currentSongIndex) {
       if (audioRef.current) {
          audioRef.current.currentTime = 0;
          if (!state.isPlaying) {
             audioRef.current.play().catch(e => console.error("Loop replay failed:", e));
             setState(prev => ({ ...prev, isPlaying: true }));
          } else {
             audioRef.current.play().catch(console.error);
          }
       }
       return;
    }

    handleSongSelect(nextIndex);
  };

  const playPrevious = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
    } else {
      // If shuffle is on, behavior varies. Some apps go back in history, some just go to prev index.
      // For simplicity, let's keep previous index behavior or loop to end.
      let prevIndex = state.currentSongIndex - 1;
      if (prevIndex < 0) {
         prevIndex = playlistItems.length - 1; // Loop to last
      }
      handleSongSelect(prevIndex);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    state.isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  // Play/Pause effect
  useEffect(() => {
    if (state.isPlaying && audioRef.current) {
      audioRef.current.play().catch((e) => console.error("Playback failed", e));
    }
  }, [state.url, state.isPlaying]);

  // Media Session & Discord Presence can be added here or in extra hooks.
  // Including them for completeness as they rely on player state.

  // Update Discord Rich Presence
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!isElectron || !electronAPI?.updateDiscordPresence) return;

    const audio = audioRef.current;
    
    electronAPI.updateDiscordPresence({
      title: state.metadata.title,
      artist: state.metadata.artist,
      isPlaying: state.isPlaying,
      currentTime: audio?.currentTime || 0,
      duration: audio?.duration || state.duration,
    });
    
    if (state.metadata.title && state.metadata.artist !== "Unknown Artist") {
       resolveITunesCoverUrl(state.metadata.title, state.metadata.artist).then(url => {
         if (url) {
            electronAPI.updateDiscordPresence({
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
    state.duration, // Trigger update when new song's duration is loaded
  ]);

  // Media Session API
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: state.metadata.title,
        artist: state.metadata.artist,
        album: state.metadata.album || "Unknown Album",
        artwork: state.metadata.cover
          ? [{ src: state.metadata.cover, sizes: "512x512", type: "image/png" }]
          : [],
      });

      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
      navigator.mediaSession.setActionHandler("nexttrack", playNext);
    }
  }, [state.metadata, playPrevious, playNext]);
  
  // Clear Discord presence on unmount
  useEffect(() => {
    return () => {
      const electronAPI = (window as any).electronAPI;
      if (isElectron && electronAPI?.clearDiscordPresence) {
        electronAPI.clearDiscordPresence();
      }
    };
  }, []);

  return {
    audioRef,
    playSongFromItem,
    playSong,
    handleSongSelect,
    playNext,
    playPrevious,
    togglePlay,
  };
};
