
import React, { startTransition, useCallback, useEffect, useState } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { usePlayer } from './app/hooks/usePlayer';
import { useLibrary } from './app/hooks/useLibrary';
import { useAudio } from './app/hooks/useAudio';
import { useLyrics } from './app/hooks/useLyrics';
import { useUI } from './app/hooks/useUI';
import { ImportScreen } from './app/components/ImportScreen';
import { LibraryView } from './app/components/LibraryView';
import { PlayerOverlay } from './app/components/PlayerOverlay';
import { FooterPlayer } from './app/components/FooterPlayer';

// Helper to check if running in Electron
const isElectron = !!(window as any).electronAPI;

const App: React.FC = () => {
  // 1. Player State
  const { state, setState, isLoading, setIsLoading, volume, setVolume, audioInfo, setAudioInfo } = usePlayer();

  // 2. Library & Metadata
  const { 
    playlistItems, 
    setPlaylistItems,
    folderPlaylists,
    albums, 
    artists, 
    metadataLoaded, 
    hasCheckedSaved, 
    isRefreshingLibrary,
    handleFileChange, 
    handleFolderChange, 
    handleElectronFolderSelect, 
    refreshElectronFolder,
    handleElectronFileSelect,
    loadAllMetadata,
    toTitleCase
  } = useLibrary(state, setState, async (item, index) => {
    // Import complete callback - auto play
    // When importing, we reset the queue to the full playlist
    // We need to access the LATEST playlistItems here.
    // However, playlistItems is from the hook.
    // We'll handle the "auto play first item" inside handleFileChange/FolderChange manually 
    // effectively by updating the queue there if needed, OR we just let the user 
    // click play.
    // Actually, useLibrary calls this `playSongFromItem` fn.
    // We can just update the queue here!
    
    // NOTE: This callback is essentially "play this item immediately".
    // So we should set the queue to the current playlistItems (which includes the new files).
    // BUT `playlistItems` in this scope might be stale during the callback execution?
    // Let's rely on the fact that useLibrary updates state.playlistItems.
    
    // Simple fix: We will update the queue when `playlistItems` changes IF we are in "Default" mode?
    // No, explicit action is better.
    
    // For now, let's just expose a way to set Queue.
    // check handlePlayFromContext below.
  }, (message) => {
     uiHook.setViewMode('playlist');
     uiHook.setLibraryToastMessage(message);
  });

  // 2.5 Queue System
  // The playback queue. defaults to all playlist items.
  const [queue, setQueue] = React.useState<typeof playlistItems>([]);
  const queueKey = React.useCallback((item: typeof playlistItems[number]) => item.path || item.name, []);

  // Sync queue with playlistItems ONLY when playlistItems changes AND 
  // we haven't explicitly set a custom queue (like an album).
  // actually, simplified: Initialize queue with playlistItems.
  // When user clicks "All Songs" or imports, we reset queue to all items.
  useEffect(() => {
     // Initial queue setup
     if (queue.length === 0 && playlistItems.length > 0) {
        setQueue(playlistItems);
        return;
     }

     // Keep metadata/cover in queue fresh as library metadata finishes loading.
     if (queue.length === 0 || playlistItems.length === 0) return;
     const playlistMap = new Map(playlistItems.map((item) => [queueKey(item), item]));

     setQueue((prevQueue) => {
       let changed = false;
       const merged = prevQueue.map((item) => {
         const latest = playlistMap.get(queueKey(item));
         if (!latest) return item;

         if (latest.metadata !== item.metadata) {
           changed = true;
           return { ...item, metadata: latest.metadata };
         }
         return item;
       });

       return changed ? merged : prevQueue;
     });
  }, [playlistItems, queue.length, queueKey]);

  // 3. Audio Control (Pass QUEUE instead of playlistItems)
  const audioHook = useAudio(state, setState, queue, volume, setAudioInfo, setIsLoading);

  const handlePlayFromContext = (item: typeof playlistItems[0], index: number, contextParams: { type: 'playlist' | 'album' | 'artist', id?: string, items: typeof playlistItems }) => {
    // 1. Update Queue
    setQueue(contextParams.items);
    
    // 2. Sync state.playlist so indices match the playing queue
    setState(prev => ({
      ...prev,
      playlist: contextParams.items
    }));
    
    // 3. Play the song (using the index relative to the NEW queue)
    // We need to find the index of 'item' in 'contextParams.items'
    const newIndex = contextParams.items.indexOf(item);
    if (newIndex >= 0) {
      audioHook.playSongFromItem(item, newIndex);
    } else {
      console.warn("Song not found in context queue");
    }
  };
  
  // 4. UI State
  const uiHook = useUI(state.metadata);
  
  // 5. Lyrics & Scroll
  const lyricsHook = useLyrics(state, audioHook.audioRef, uiHook.showLyrics);
  const [isDocumentFullscreen, setIsDocumentFullscreen] = useState(false);
  const [isFullscreenTransitioning, setIsFullscreenTransitioning] = useState(false);
  const hasMountedFullscreenRef = React.useRef(false);

  const requestDocumentFullscreen = useCallback(async () => {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
      return true;
    }

    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch {
      // Some browsers may block fullscreen outside trusted app windows.
      return false;
    }
  }, []);

  const openLyricsPlayerView = useCallback(() => {
    startTransition(() => {
      uiHook.setShowLyrics(true);
      uiHook.setIsFullScreenPlayer(true);
    });
  }, [uiHook.setIsFullScreenPlayer, uiHook.setShowLyrics]);

  useEffect(() => {
    if (!uiHook.libraryToastMessage) return;

    const timer = setTimeout(() => {
      uiHook.setLibraryToastMessage(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [uiHook.libraryToastMessage, uiHook.setLibraryToastMessage]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsDocumentFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!hasMountedFullscreenRef.current) {
      hasMountedFullscreenRef.current = true;
      return;
    }

    setIsFullscreenTransitioning(true);
    const timer = window.setTimeout(() => {
      setIsFullscreenTransitioning(false);
    }, 760);

    return () => window.clearTimeout(timer);
  }, [uiHook.isFullScreenPlayer]);

  const openLyricsFullscreen = useCallback(() => {
    startTransition(() => {
      uiHook.setShowLyrics(true);
      uiHook.setIsFullScreenPlayer(true);
    });

    window.requestAnimationFrame(() => {
      void requestDocumentFullscreen();
    });
  }, [requestDocumentFullscreen, uiHook.setIsFullScreenPlayer, uiHook.setShowLyrics]);

  const openPlayerWithLyrics = useCallback(() => {
    openLyricsPlayerView();

    if (document.fullscreenElement) {
      return;
    }

    window.requestAnimationFrame(() => {
      void requestDocumentFullscreen();
    });
  }, [openLyricsPlayerView, requestDocumentFullscreen]);

  const exitLyricsFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        // Ignore fullscreen exit failures from browser policy.
      });
    }
  }, []);

  return (
    <div 
      className="h-screen w-full flex flex-col bg-black text-white overflow-hidden app-bg transition-colors duration-700 ease-in-out"
      style={{
        background: `linear-gradient(to bottom right, ${uiHook.dominantColor}, ${uiHook.adjustBrightness(uiHook.dominantColor, -0.4)})`
      } as React.CSSProperties}
    >
      {/* Import Screen / Empty State */}
      {hasCheckedSaved && playlistItems.length === 0 && (
         <ImportScreen 
           isElectron={isElectron}
           onFolderChange={handleFolderChange}
           onFileChange={handleFileChange}
           onElectronFolderSelect={handleElectronFolderSelect}
           onElectronFileSelect={handleElectronFileSelect}
         />
      )}

      {/* Initial Loading Screen */}
      {(!hasCheckedSaved) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#050505] text-white">
          <div className="loading-spinner"></div>
        </div>
      )}

      <div className={`absolute inset-0 z-0 pointer-events-none lumina-app-backdrop ${isFullscreenTransitioning ? 'lumina-app-backdrop-transitioning' : ''}`}></div>

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col relative overflow-hidden">
         {/* Player Overlay (Full Screen + Lyrics) */}
         <PlayerOverlay 
            state={state}
            audioInfo={audioInfo}
            dominantColor={uiHook.dominantColor}
            isLdacSupported={uiHook.isLdacSupported}
            isFullScreenPlayer={uiHook.isFullScreenPlayer}
            isFullscreenTransitioning={isFullscreenTransitioning}
            setIsFullScreenPlayer={uiHook.setIsFullScreenPlayer}
            showLyrics={uiHook.showLyrics}
            setShowLyrics={uiHook.setShowLyrics}
            openLyricsFullscreen={openLyricsFullscreen}
            exitLyricsFullscreen={exitLyricsFullscreen}
            isDocumentFullscreen={isDocumentFullscreen}
            showVolumePopup={uiHook.showVolumePopup}
            setShowVolumePopup={uiHook.setShowVolumePopup}
            volume={volume}
            setVolume={setVolume}
            togglePlay={audioHook.togglePlay}
            playNext={audioHook.playNext}
            playPrevious={audioHook.playPrevious}
            queueItems={queue}
            onQueueItemSelect={audioHook.handleSongSelect}
            audioRef={audioHook.audioRef}
            setState={setState}
            // Lyrics props
            lyricsContainerRef={lyricsHook.lyricsContainerRef}
            activeLyricIndex={lyricsHook.activeLyricIndex}
            autoScrollEnabled={lyricsHook.autoScrollEnabled}
            stopAutoScroll={lyricsHook.stopAutoScroll}
            resumeAutoScroll={lyricsHook.resumeAutoScroll}
            resetLyricsLayout={lyricsHook.resetLyricsLayout}
            isLoading={isLoading}
            hasStarted={lyricsHook.hasStarted}
            // UI Helpers
            setViewMode={uiHook.setViewMode}
            setIsRestoringLayout={uiHook.setIsRestoringLayout}
            viewMode={uiHook.viewMode}
         />

         {/* Library View (Playlist, Albums, Artists) */}
         <LibraryView 
            viewMode={uiHook.viewMode}
            setViewMode={uiHook.setViewMode}
            playlistItems={playlistItems}
            folderPlaylists={folderPlaylists}
            albums={albums}
            artists={artists}
            metadataLoaded={metadataLoaded}
            state={state}
            handleSongSelect={(index) => {
              // Default playlist view selection (Global Context)
              handlePlayFromContext(playlistItems[index], index, { type: 'playlist', items: playlistItems });
            }}
            openPlaylist={uiHook.openPlaylist}
            selectedAlbum={uiHook.selectedAlbum}
            setSelectedAlbum={uiHook.setSelectedAlbum}
            selectedArtist={uiHook.selectedArtist}
            setSelectedArtist={uiHook.setSelectedArtist}
            toTitleCase={toTitleCase}
            isElectron={isElectron}
            handleElectronFolderSelect={handleElectronFolderSelect}
            refreshElectronFolder={refreshElectronFolder}
            isRefreshingLibrary={isRefreshingLibrary}
            handleFolderChange={handleFolderChange}
            handleElectronFileSelect={handleElectronFileSelect}
            handleFileChange={handleFileChange}
            setShowSettingsModal={uiHook.setShowSettingsModal}
            isRestoringLayout={uiHook.isRestoringLayout}
            setIsViewReady={uiHook.setIsViewReady}
            // Context Playback Prop
            onPlayContext={handlePlayFromContext}
            // Playback Control
            togglePlay={audioHook.togglePlay}
         />
      </main>

      {/* Footer Player */}
       <FooterPlayer 
         state={state}
         audioInfo={audioInfo}
         playlistCount={queue.length} // Show Queue count now
         isFullScreenPlayer={uiHook.isFullScreenPlayer}
         isFullscreenTransitioning={isFullscreenTransitioning}
         isDocumentFullscreen={isDocumentFullscreen}
         setIsFullScreenPlayer={uiHook.setIsFullScreenPlayer}
         openPlayerWithLyrics={openPlayerWithLyrics}
         exitDocumentFullscreen={exitLyricsFullscreen}
         playPrevious={audioHook.playPrevious}
         playNext={audioHook.playNext}
         togglePlay={audioHook.togglePlay}
         audioRef={audioHook.audioRef}
         setState={setState}
         volume={volume}
         setVolume={setVolume}
      />

      {/* Hidden Audio Element */}
      <audio
        ref={audioHook.audioRef}
        src={state.url}
        onTimeUpdate={() =>
          setState((prev) => ({
            ...prev,
            currentTime: audioHook.audioRef.current?.currentTime || 0,
          }))
        }
        onLoadedMetadata={() => {
          const duration = audioHook.audioRef.current?.duration || 0;
          setState((prev) => ({
            ...prev,
            duration,
          }));
          // Calculate bitrate
          if ((window as any).__calculateBitrate) {
            (window as any).__calculateBitrate(duration);
          }
        }}
        onEnded={audioHook.playNext}
        onPlay={() => setState((prev) => ({ ...prev, isPlaying: true }))}
        onPause={() => setState((prev) => ({ ...prev, isPlaying: false }))}
      />

      <SettingsModal
        isOpen={uiHook.showSettingsModal}
        onClose={() => uiHook.setShowSettingsModal(false)}
      />
      
      {/* Library Action Notification */}
      {uiHook.libraryToastMessage && hasCheckedSaved && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 transform translate-y-0 opacity-100">
          <div className="bg-white text-black px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-3">
             <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
             </div>
             <span className="font-bold text-sm tracking-wide uppercase">{uiHook.libraryToastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
