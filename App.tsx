
import React, { useEffect } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
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
  }, () => {
     uiHook.setViewMode('playlist');
     uiHook.setShowImportSuccess(true);
     setTimeout(() => uiHook.setShowImportSuccess(false), 3000);
  });

  // 2.5 Queue System
  // The playback queue. defaults to all playlist items.
  const [queue, setQueue] = React.useState<typeof playlistItems>([]);

  // Sync queue with playlistItems ONLY when playlistItems changes AND 
  // we haven't explicitly set a custom queue (like an album).
  // actually, simplified: Initialize queue with playlistItems.
  // When user clicks "All Songs" or imports, we reset queue to all items.
  useEffect(() => {
     // If the queue is empty or we just imported, sync it. 
     // For now, let's just keep them in sync if we are in "Playlist" mode implicitly?
     // No, explicit is better.
     if (queue.length === 0 && playlistItems.length > 0) {
        setQueue(playlistItems);
     }
  }, [playlistItems]);

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
  
  // 4. Lyrics & Scroll
  const lyricsHook = useLyrics(state, audioHook.audioRef);
  
  // 5. UI State
  const uiHook = useUI(state.metadata);

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

      <div className="absolute inset-0 bg-black/30 backdrop-blur-3xl z-0 pointer-events-none"></div>

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col relative overflow-hidden">
         {/* Player Overlay (Full Screen + Lyrics) */}
         <PlayerOverlay 
            state={state}
            audioInfo={audioInfo}
            dominantColor={uiHook.dominantColor}
            isLdacSupported={uiHook.isLdacSupported}
            isFullScreenPlayer={uiHook.isFullScreenPlayer}
            setIsFullScreenPlayer={uiHook.setIsFullScreenPlayer}
            showLyrics={uiHook.showLyrics}
            setShowLyrics={uiHook.setShowLyrics}
            showVolumePopup={uiHook.showVolumePopup}
            setShowVolumePopup={uiHook.setShowVolumePopup}
            volume={volume}
            setVolume={setVolume}
            togglePlay={audioHook.togglePlay}
            playNext={audioHook.playNext}
            playPrevious={audioHook.playPrevious}
            audioRef={audioHook.audioRef}
            setState={setState}
            // Lyrics props
            lyricsContainerRef={lyricsHook.lyricsContainerRef}
            activeLyricIndex={lyricsHook.activeLyricIndex}
            autoScrollEnabled={lyricsHook.autoScrollEnabled}
            stopAutoScroll={lyricsHook.stopAutoScroll}
            resumeAutoScroll={lyricsHook.resumeAutoScroll}
            isLoading={isLoading}
            hasStarted={lyricsHook.hasStarted}
            // UI Helpers
            setViewMode={uiHook.setViewMode}
            setIsRestoringLayout={uiHook.setIsRestoringLayout}
            viewMode={uiHook.viewMode}
            scrollToActiveLine={lyricsHook.scrollToActiveLine}
         />

         {/* Library View (Playlist, Albums, Artists) */}
         <LibraryView 
            viewMode={uiHook.viewMode}
            setViewMode={uiHook.setViewMode}
            playlistItems={playlistItems}
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
            handleFolderChange={handleFolderChange}
            handleElectronFileSelect={handleElectronFileSelect}
            handleFileChange={handleFileChange}
            setShowApiKeyModal={uiHook.setShowApiKeyModal}
            isRestoringLayout={uiHook.isRestoringLayout}
            setIsViewReady={uiHook.setIsViewReady}
            // Context Playback Prop
            onPlayContext={handlePlayFromContext}
         />
      </main>

      {/* Footer Player */}
      <FooterPlayer 
         state={state}
         audioInfo={audioInfo}
         playlistCount={queue.length} // Show Queue count now
         isFullScreenPlayer={uiHook.isFullScreenPlayer}
         setIsFullScreenPlayer={uiHook.setIsFullScreenPlayer}
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

      <ApiKeyModal
        isOpen={uiHook.showApiKeyModal}
        onClose={() => uiHook.setShowApiKeyModal(false)}
        onSave={() => {}}
      />
      
      {/* Import Success Notification */}
      {uiHook.showImportSuccess && hasCheckedSaved && playlistItems.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 transform translate-y-0 opacity-100">
          <div className="bg-white text-black px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-3">
             <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
             </div>
             <span className="font-bold text-sm tracking-wide uppercase">Imported Successfully</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
