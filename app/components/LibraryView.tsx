
import React, { useRef, useEffect } from 'react';
import { ViewMode, PlaylistItem, AlbumInfo, ArtistInfo, SongState } from '../types';
import { LazyImage } from '../../components/LazyImage';

interface LibraryViewProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  playlistItems: PlaylistItem[];
  albums: AlbumInfo[];
  artists: ArtistInfo[];
  metadataLoaded: boolean;
  state: SongState;
  handleSongSelect: (index: number) => void;
  openPlaylist: () => void;
  
  // Selection
  selectedAlbum: string | null;
  setSelectedAlbum: (id: string | null) => void;
  selectedArtist: string | null;
  setSelectedArtist: (id: string | null) => void;
  
  // Helpers
  toTitleCase: (str: string) => string;
  isElectron: boolean;
  handleElectronFolderSelect: () => void;
  handleFolderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleElectronFileSelect: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowApiKeyModal: (v: boolean) => void;
  
  // Transitions
  isRestoringLayout: boolean;
  setIsViewReady: (v: boolean) => void;
  // Context Playback
  onPlayContext: (item: PlaylistItem, index: number, contextParams: { type: 'playlist' | 'album' | 'artist', id?: string, items: PlaylistItem[] }) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  viewMode,
  setViewMode,
  playlistItems,
  albums,
  artists,
  metadataLoaded,
  state,
  handleSongSelect,
  openPlaylist,
  selectedAlbum,
  setSelectedAlbum,
  selectedArtist,
  setSelectedArtist,
  toTitleCase,
  isElectron,
  handleElectronFolderSelect,
  handleFolderChange,
  handleElectronFileSelect,
  handleFileChange,
  setShowApiKeyModal,
  isRestoringLayout,
  setIsViewReady,
  onPlayContext
}) => {
  const playlistContainerRef = useRef<HTMLDivElement>(null);
  const albumsContainerRef = useRef<HTMLDivElement>(null);
  const artistsContainerRef = useRef<HTMLDivElement>(null);
  const albumDetailContainerRef = useRef<HTMLDivElement>(null);
  const artistDetailContainerRef = useRef<HTMLDivElement>(null);

  // Derived state (copied from App.tsx logic for rendering)
  // Get current song's album key
  const currentSongAlbumKey = React.useMemo(() => {
    if (state.currentSongIndex < 0) return null;
    // Fix: Use state.playlist (Queue) instead of playlistItems (Library)
    // The currentSongIndex is always relative to state.playlist
    const item = state.playlist[state.currentSongIndex];
    if (!item?.metadata) return null;
    return `${item.metadata.album || "Unknown Album"}__${item.metadata.artist}`;
  }, [state.currentSongIndex, state.playlist]);

  const currentSongArtist = React.useMemo(() => {
    if (state.currentSongIndex < 0) return null;
    // Fix: Use state.playlist (Queue) 
    const item = state.playlist[state.currentSongIndex];
    return item?.metadata?.artist || null;
  }, [state.currentSongIndex, state.playlist]);

  const selectedAlbumTracks = React.useMemo(() => {
    if (!selectedAlbum) return [];
    const album = albums.find(
      (a) => `${a.name}__${a.artist}` === selectedAlbum
    );
    if (!album) return [];
    return album.trackIndices.map((idx) => ({ item: playlistItems[idx], idx }));
  }, [selectedAlbum, albums, playlistItems]);

  const selectedArtistTracks = React.useMemo(() => {
    if (!selectedArtist) return [];
    const artist = artists.find((a) => a.name === selectedArtist);
    if (!artist) return [];
    return artist.trackIndices.map((idx) => ({
      item: playlistItems[idx],
      idx,
    }));
  }, [selectedArtist, artists, playlistItems]);

  const selectedAlbumInfo = React.useMemo(() => {
    if (!selectedAlbum) return null;
    return (
      albums.find((a) => `${a.name}__${a.artist}` === selectedAlbum) || null
    );
  }, [selectedAlbum, albums]);

  const selectedArtistInfo = React.useMemo(() => {
    if (!selectedArtist) return null;
    return artists.find((a) => a.name === selectedArtist) || null;
  }, [selectedArtist, artists]);


  // Scrolls
  useEffect(() => {
    if (viewMode === "playlist" && state.currentSongIndex >= 0) {
      requestAnimationFrame(() => {
        if (!playlistContainerRef.current) return;
        // +1 because the header is now the first child
        const currentItem = playlistContainerRef.current.children[state.currentSongIndex + 1] as HTMLElement;
        if (currentItem) {
          currentItem.scrollIntoView({ behavior: "instant", block: "center" });
        }
      });
    }
  }, [viewMode]);

   // Scroll to current album when albums view opens
   useEffect(() => {
    if (viewMode === "albums" && currentSongAlbumKey) {
      requestAnimationFrame(() => {
        if (!albumsContainerRef.current) return;
        const albumIndex = albums.findIndex(
          (a) => `${a.name}__${a.artist}` === currentSongAlbumKey
        );
        if (albumIndex >= 0) {
          const albumElement = albumsContainerRef.current.children[albumIndex] as HTMLElement;
          if (albumElement) {
            albumElement.scrollIntoView({ behavior: "instant", block: "center" });
          }
        }
      });
    }
  }, [viewMode, currentSongAlbumKey, albums]);

  // Scroll to current artist
  useEffect(() => {
    if (viewMode === "artists" && currentSongArtist) {
      requestAnimationFrame(() => {
        if (!artistsContainerRef.current) return;
        const artistIndex = artists.findIndex((a) => a.name === currentSongArtist);
        if (artistIndex >= 0) {
          const artistElement = artistsContainerRef.current.children[artistIndex] as HTMLElement;
          if (artistElement) {
            artistElement.scrollIntoView({ behavior: "instant", block: "center" });
          }
        }
      });
    }
  }, [viewMode, currentSongArtist, artists]);

  return (
    <div className="w-full h-full relative flex flex-col bg-transparent border-t border-white/5">
          {/* Library Navigation Bar */}
            <div className="w-full px-8 pt-6 pb-2 flex items-center justify-center relative z-30 shrink-0 border-b border-transparent">
               {/* Tabs */}
               <div className="flex items-center gap-12">

                  <button 
                    onClick={openPlaylist} 
                    className={`text-sm font-bold uppercase tracking-[0.2em] hover:text-white transition-colors ${viewMode === 'playlist' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}
                  >
                    Playlist
                  </button>
                  <button 
                    onClick={() => {
                      setIsViewReady(false);
                      if (currentSongAlbumKey) {
                        setSelectedAlbum(currentSongAlbumKey);
                        setViewMode("album-detail");
                      } else {
                        setSelectedAlbum(null);
                        setViewMode("albums");
                      }
                      requestAnimationFrame(() => setIsViewReady(true));
                    }}
                    className={`text-sm font-bold uppercase tracking-[0.2em] hover:text-white transition-colors ${viewMode === 'albums' || viewMode === 'album-detail' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}
                  >
                    Albums
                  </button>
                  <button 
                    onClick={() => {
                       setIsViewReady(false);
                       if (currentSongArtist) {
                         setSelectedArtist(currentSongArtist);
                         setViewMode("artist-detail");
                       } else {
                         setSelectedArtist(null);
                         setViewMode("artists");
                       }
                       requestAnimationFrame(() => setIsViewReady(true));
                    }}
                    className={`text-sm font-bold uppercase tracking-[0.2em] hover:text-white transition-colors ${viewMode === 'artists' || viewMode === 'artist-detail' ? 'text-white border-b-2 border-white pb-1' : 'text-white/40 border-b-2 border-transparent pb-1'}`}
                  >
                    Artists
                  </button>
               </div>
               
               {/* Actions */}
               <div className="absolute right-8 flex items-center gap-4">
                  {isElectron ? (
                    <button onClick={handleElectronFolderSelect} className="text-white/40 hover:text-white transition-colors" title="Import Folder">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                    </button>
                  ) : (
                    <label className="text-white/40 hover:text-white transition-colors cursor-pointer" title="Import Folder">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                      <input type="file" // @ts-ignore
                      webkitdirectory="" directory="" className="hidden" onChange={handleFolderChange} />
                    </label>
                  )}

                  {isElectron ? (
                    <button onClick={handleElectronFileSelect} className="text-white/40 hover:text-white transition-colors" title="Import Track">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                    </button>
                  ) : (
                    <label className="text-white/40 hover:text-white transition-colors cursor-pointer" title="Import Track">
                       <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                      <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  )}

                  <button onClick={() => setShowApiKeyModal(true)} className="text-white/40 hover:text-white transition-colors" title="Settings">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                  </button>
               </div>
            </div>
          {viewMode === "playlist" ? (
            <div className={`flex flex-col flex-1 min-h-0 content-visibility-auto transition-opacity duration-300 ${isRestoringLayout ? "opacity-0" : "opacity-100"}`}>
              {!isRestoringLayout && (
                <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                  <div ref={playlistContainerRef} className="flex flex-col">
                    {/* Table Header (Now Scrolls) */}
                    <div className="flex items-center px-4 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 bg-transparent mb-2">
                      <div className="w-12 shrink-0">#</div>
                      <div className="flex-1 min-w-0 pr-4">Song</div>
                      <div className="w-[180px] hidden md:block px-4">Artist</div>
                      <div className="w-[220px] hidden lg:block px-4">Album</div>
                      <div className="w-16 text-right">Time</div>
                      <div className="w-10 shrink-0"></div>
                    </div>
                    {(playlistItems.length > 0
                      ? playlistItems
                      : state.playlist.map((f) => ({ file: f, name: f.name }))
                    ).map((item, idx) => {
                      const currentSong = state.playlist[state.currentSongIndex];
                      const isPlaying = currentSong && (
                        (item.path && item.path === currentSong.path) ||
                        (item.name === currentSong.name)
                      );
                      const duration = item.metadata?.duration;
                      const formatDuration = (d?: number) => {
                        if (!d) return "--:--";
                        const mins = Math.floor(d / 60);
                        const secs = Math.floor(d % 60);
                        return `${mins}:${secs.toString().padStart(2, '0')}`;
                      };

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSongSelect(idx)}
                          className={`playlist-item group flex items-center px-4 py-3 rounded-md cursor-pointer transition-all duration-200 hover:bg-white/5 ${
                            isPlaying ? "active bg-white/5" : ""
                          }`}
                        >
                          {/* Number / Playing Indicator */}
                          <div className="w-12 shrink-0 flex items-center">
                            {isPlaying ? (
                              <div className="playing-indicator-v2">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-white/20 group-hover:hidden">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                            )}
                            {!isPlaying && (
                              <svg className="w-4 h-4 text-white/60 hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                          </div>

                          {/* Song Title & Artwork */}
                          <div className="flex-1 min-w-0 flex items-center gap-4">
                            <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-white/5 relative shadow-lg">
                              {item.metadata?.cover ? (
                                <LazyImage
                                  src={item.metadata.cover}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  placeholderClassName="w-full h-full"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                                </div>
                              )}
                              {isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                              </div>}
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-sm font-medium tracking-wide truncate ${isPlaying ? 'text-[#f1c40f]' : 'text-white/90'}`}>
                                {item.metadata?.title || item.name.replace(/\.[^/.]+$/, "")}
                              </h4>
                            </div>
                          </div>

                          {/* Artist */}
                          <div className="w-[180px] hidden md:block px-4 truncate text-sm text-white/50 group-hover:text-white/70 transition-colors">
                            {item.metadata?.artist || "Unknown Artist"}
                          </div>

                          {/* Album */}
                          <div className="w-[220px] hidden lg:block px-4 truncate text-sm text-white/40 group-hover:text-white/60 transition-colors">
                            {item.metadata?.album || "Unknown Album"}
                          </div>

                          {/* Duration */}
                          <div className="w-16 text-right text-xs font-mono text-white/30 group-hover:text-white/60">
                            {formatDuration(duration)}
                          </div>

                          {/* Actions */}
                          <div className="w-10 shrink-0 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="text-white/40 hover:text-white">
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                              </button>
                          </div>
                        </div>
                      );
                    })}
                    {playlistItems.length === 0 &&
                      state.playlist.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                          <svg className="w-16 h-16 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                          <p className="text-white/20 text-sm uppercase tracking-widest">No tracks in playlist</p>
                          <p className="text-white/10 text-xs">Import a folder or track to get started</p>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === "albums" ? (
            // Albums Grid View
            <div className={`flex flex-col flex-1 min-h-0 content-visibility-auto transition-opacity duration-300 ${isRestoringLayout ? "opacity-0" : "opacity-100"}`}>
              {!isRestoringLayout && (
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
              )}
            </div>
          ) : viewMode === "album-detail" && selectedAlbum ? (
            // Album Detail View
            <div className="flex flex-col flex-1 min-h-0">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black/20 backdrop-blur-md z-20 shrink-0">
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
                  {selectedAlbumTracks.map(({ item, idx }, i) => {
                    const currentSong = state.playlist[state.currentSongIndex];
                    const isPlaying = currentSong && (
                       (item.path && item.path === currentSong.path) ||
                       (item.name === currentSong.name)
                    );
                    
                    return (
                    <div
                      key={idx}
                      onClick={() => onPlayContext(item, idx, { 
                        type: 'album', 
                        id: selectedAlbum || '', 
                        items: selectedAlbumTracks.map(t => t.item)
                      })}
                      className={`playlist-item virtual-list-item p-4 rounded-lg cursor-pointer flex items-center gap-4 ${
                        isPlaying ? "active" : ""
                      }`}
                    >
                      <span className="text-xs font-mono text-white/30 w-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium tracking-wide truncate flex-1">
                        {item.metadata?.title ||
                          item.name.replace(/\.[^/.]+$/, "")}
                      </span>
                      {isPlaying && (
                        <div className="playing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            </div>
          ) : viewMode === "artists" ? (
            // Artists List View
            <div className={`flex flex-col flex-1 min-h-0 content-visibility-auto transition-opacity duration-300 ${isRestoringLayout ? "opacity-0" : "opacity-100"}`}>

              {!isRestoringLayout && (
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
              )}
            </div>
          ) : viewMode === "artist-detail" && selectedArtist ? (
            // Artist Detail View
            <div className="flex flex-col flex-1 min-h-0">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black/20 backdrop-blur-md z-20 shrink-0">
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
                  {selectedArtistTracks.map(({ item, idx }, i) => {
                    const currentSong = state.playlist[state.currentSongIndex];
                    const isPlaying = currentSong && (
                       (item.path && item.path === currentSong.path) ||
                       (item.name === currentSong.name)
                    );
                    
                    return (
                    <div
                      key={idx}
                      onClick={() => onPlayContext(item, idx, { 
                        type: 'artist', 
                        id: selectedArtist || '', 
                        items: selectedArtistTracks.map(t => t.item)
                      })}
                      className={`playlist-item virtual-list-item p-4 rounded-lg cursor-pointer flex items-center gap-4 ${
                        isPlaying ? "active" : ""
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
                      {isPlaying && (
                        <div className="playing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            </div>
          ) : null}
    </div>
  );
};
