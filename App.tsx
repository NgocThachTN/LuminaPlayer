import React, { useState, useRef, useEffect } from "react";
import { SongState, LyricsResult } from "./types";
import { getLyrics } from "./services/geminiService";
import { extractMetadata } from "./services/metadataService";
import { Visualizer } from "./components/Visualizer";
import { ApiKeyModal } from "./components/ApiKeyModal";

const emptyLyrics: LyricsResult = { synced: [], plain: [], isSynced: false };

// Helper to check if running in Electron
const isElectron = !!window.electronAPI;

// Playlist item can be File (web) or path string (Electron saved)
interface PlaylistItem {
  file?: File;
  path?: string;
  name: string;
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
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);

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
            setShowPlaylist(true);
          }
        }
      } catch (e) {
        console.error("Error loading saved playlist:", e);
      }
    };

    loadSavedPlaylist();
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

    setShowPlaylist(true);
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
    setShowPlaylist(true);
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

  // Play from playlist item (supports both File and path)
  const playSongFromItem = async (item: PlaylistItem, index: number) => {
    setIsLoading(true);
    setActiveLyricIndex(-1);

    // Scroll lyrics về đầu trang
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
    }

    let url = "";
    let file: File | null = null;

    // If we have a File object, use it
    if (item.file) {
      file = item.file;
      url = URL.createObjectURL(file);
    }
    // If we only have path (loaded from Electron storage), read the file
    else if (item.path && isElectron && window.electronAPI) {
      const fileData = await window.electronAPI.readFileBuffer(item.path);
      if (fileData) {
        // Convert base64 to blob
        const byteCharacters = atob(fileData.buffer);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileData.mimeType });
        url = URL.createObjectURL(blob);
        file = new File([blob], fileData.name, { type: fileData.mimeType });
      }
    }

    if (!url || !file) {
      console.error("Could not load audio file");
      setIsLoading(false);
      return;
    }

    // Extract metadata first
    const metadata = await extractMetadata(file);

    // Start playing immediately without waiting for lyrics
    setState((prev) => ({
      ...prev,
      file,
      url,
      metadata,
      lyrics: emptyLyrics,
      isPlaying: true,
      currentTime: 0,
      currentSongIndex: index,
    }));

    // Save current index to Electron storage
    if (isElectron && window.electronAPI) {
      await window.electronAPI.saveCurrentIndex(index);
    }

    // Load lyrics in background
    const lyrics = await getLyrics(metadata.title, metadata.artist);

    // Update lyrics when ready (only if still same song)
    setState((prev) => {
      if (prev.currentSongIndex === index) {
        return { ...prev, lyrics };
      }
      return prev;
    });

    setIsLoading(false);
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
    setShowPlaylist(false); // Chuyển sang tab Lyrics sau khi chọn bài
  };

  const playNext = () => {
    if (state.currentSongIndex < state.playlist.length - 1) {
      handleSongSelect(state.currentSongIndex + 1);
    } else {
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const playPrevious = () => {
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
    <div className="h-screen w-full flex flex-col bg-black text-white overflow-hidden">
      {/* Top Border Navigation */}
      <header className="w-full flex justify-between items-center border-b border-white/10 px-6 py-4 z-50">
        <div className="flex items-center gap-4">
          <span className="font-black text-2xl tracking-[0.1em]">
            Lumina Music Player
          </span>
        </div>

        <div className="flex items-center gap-0">
          <button
            onClick={() => setShowPlaylist(false)}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${
              !showPlaylist
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Lyrics
          </button>
          <button
            onClick={() => setShowPlaylist(true)}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${
              showPlaylist
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Playlist
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
        <div className="w-full md:w-[40%] flex flex-col border-r border-white/10">
          <div className="aspect-square w-full bg-neutral-900 border-b border-white/10 overflow-hidden">
            <img
              src={state.metadata.cover}
              className="w-full h-full object-cover"
              alt="Cover Art"
            />
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-white/40 mb-2 uppercase tracking-[0.3em]">
                Currently Playing
              </p>
              <h2 className="text-4xl font-bold mb-4 leading-tight tracking-tight">
                {state.metadata.title}
              </h2>
              <p className="text-white/40 text-sm font-medium uppercase tracking-[0.2em]">
                {state.metadata.artist}
              </p>
            </div>

            <div className="mt-8">
              <Visualizer
                audioElement={audioRef.current}
                isPlaying={state.isPlaying}
              />
            </div>
          </div>
        </div>

        {/* Right Section: Lyrics List or Playlist */}
        <div className="w-full md:w-[60%] relative flex flex-col bg-black">
          {showPlaylist ? (
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">
                  Playlist ({playlistItems.length || state.playlist.length})
                </h3>
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                <div className="flex flex-col gap-2">
                  {(playlistItems.length > 0
                    ? playlistItems
                    : state.playlist.map((f) => ({ file: f, name: f.name }))
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSongSelect(idx)}
                      className={`p-4 border border-white/10 cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-4 ${
                        idx === state.currentSongIndex
                          ? "bg-white/10 border-white/30"
                          : ""
                      }`}
                    >
                      <span className="text-xs font-mono text-white/40 w-6">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium tracking-wider truncate flex-1">
                        {item.name.replace(/\.[^/.]+$/, "")}
                      </span>
                      {idx === state.currentSongIndex && (
                        <span className="text-[10px] uppercase tracking-widest text-white/60 animate-pulse">
                          Playing
                        </span>
                      )}
                    </div>
                  ))}
                  {playlistItems.length === 0 &&
                    state.playlist.length === 0 && (
                      <div className="text-white/20 text-sm uppercase tracking-widest text-center py-10">
                        No tracks in playlist
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border border-white/10 border-t-white animate-spin"></div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">
                Loading Lyrics
              </p>
            </div>
          ) : state.lyrics.isSynced ? (
            // Synced Lyrics View
            <div
              ref={lyricsContainerRef}
              className="h-full w-full overflow-y-auto lyrics-scroll py-[30vh] px-8 md:px-16"
            >
              {state.lyrics.synced.map((line, idx) => {
                const distance = Math.abs(idx - activeLyricIndex);
                const isNear = distance > 0 && distance <= 2;

                return (
                  <div
                    key={idx}
                    onClick={() =>
                      audioRef.current &&
                      (audioRef.current.currentTime = line.time)
                    }
                    className={`lyric-item text-xl md:text-2xl font-normal tracking-wide cursor-pointer ${
                      idx === activeLyricIndex ? "active-lyric" : ""
                    } ${isNear ? "near-active" : ""}`}
                  >
                    {line.text.toUpperCase()}
                  </div>
                );
              })}
            </div>
          ) : hasLyrics ? (
            // Plain Lyrics View
            <div
              ref={lyricsContainerRef}
              className="h-full w-full overflow-y-auto lyrics-scroll py-8 px-8 md:px-16"
            >
              <div className="flex flex-col gap-3">
                {state.lyrics.plain.map((line, idx) => (
                  <div
                    key={idx}
                    className="text-lg md:text-xl font-normal tracking-wide text-white/80 leading-relaxed"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // No Lyrics
            <div className="h-full flex items-center justify-center text-white/10 text-xs uppercase tracking-[0.5em]">
              {state.file
                ? "No Lyrics Found"
                : "System Idle - Waiting for Input"}
            </div>
          )}
          {/* Minimal Fade Overlays */}
          {!showPlaylist && hasLyrics && (
            <>
              <div
                className={`absolute top-0 left-0 w-full ${
                  state.lyrics.isSynced ? "h-32" : "h-16"
                } bg-gradient-to-b from-black to-transparent pointer-events-none`}
              ></div>
              <div
                className={`absolute bottom-0 left-0 w-full ${
                  state.lyrics.isSynced ? "h-32" : "h-16"
                } bg-gradient-to-t from-black to-transparent pointer-events-none`}
              ></div>
            </>
          )}
        </div>
      </main>

      {/* Control Strip */}
      <footer className="w-full border-t border-white/10 flex flex-col">
        {/* Progress Bar - Optimized */}
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/40 w-10 text-right">
            {formatTime(state.currentTime)}
          </span>
          <div className="flex-1 h-1 bg-white/10 relative group cursor-pointer rounded-full">
            <div
              className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-75 ease-linear"
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
          <span className="text-[10px] font-mono text-white/40 w-10">
            {formatTime(state.duration)}
          </span>
        </div>

        <div className="flex w-full items-center border-t border-white/10">
          {/* Playback Controls */}
          <div className="p-4 border-r border-white/10 flex items-center justify-center gap-2">
            {/* Previous Button */}
            <button
              onClick={playPrevious}
              disabled={state.playlist.length === 0}
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
              className="square-btn w-12 h-12 flex items-center justify-center"
            >
              {state.isPlaying ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
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
              disabled={state.playlist.length === 0}
              className="square-btn w-10 h-10 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="px-6 flex-1 flex items-center justify-between text-[10px] font-mono tracking-widest text-white/40 uppercase">
            <div>
              {(playlistItems.length || state.playlist.length) > 0
                ? `${state.currentSongIndex + 1} / ${
                    playlistItems.length || state.playlist.length
                  }`
                : "NO TRACKS"}
            </div>
            <div className="flex items-center gap-4">
              {state.lyrics.isSynced && (
                <span className="text-green-400">SYNCED</span>
              )}
              <span>STATUS: {state.isPlaying ? "PLAYING" : "PAUSED"}</span>
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
        onLoadedMetadata={() =>
          setState((prev) => ({
            ...prev,
            duration: audioRef.current?.duration || 0,
          }))
        }
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
