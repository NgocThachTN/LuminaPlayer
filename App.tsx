
import React from 'react';
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
    // Forward reference issue: playSongFromItem is defined in useAudio which needs playlistItems
    // Solution: pass a dummy or ref, OR restructure.
    // Better: useAudio needs to be initialized.
    // But useLibrary needs playSongFromItem to auto-play on import.
    // Circular dependency.
    // Resolution: Pass playSongFromItem REF or separate the play logic further.
    // For now, let's keep it simple: define playSongFromItemWrapper here and pass it.
    await audioHook.playSongFromItem(item, index);
  }, () => {
     uiHook.setViewMode('playlist');
     uiHook.setShowImportSuccess(true);
     setTimeout(() => uiHook.setShowImportSuccess(false), 3000);
  });

  // 3. Audio Control
  const audioHook = useAudio(state, setState, playlistItems, volume, setAudioInfo, setIsLoading);
  
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
            isUserScrolling={lyricsHook.isUserScrolling}
            setIsUserScrolling={lyricsHook.setIsUserScrolling}
            userScrollTimeoutRef={lyricsHook.userScrollTimeoutRef}
            isLoading={isLoading}
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
            albums={albums}
            artists={artists}
            metadataLoaded={metadataLoaded}
            state={state}
            handleSongSelect={audioHook.handleSongSelect}
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
         />
      </main>

      {/* Footer Player */}
      <FooterPlayer 
         state={state}
         audioInfo={audioInfo}
         playlistCount={playlistItems.length || state.playlist.length}
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
      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 transform ${uiHook.showImportSuccess ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
          <div className="bg-white text-black px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-3">
             <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
             </div>
             <span className="font-bold text-sm tracking-wide uppercase">Imported Successfully</span>
          </div>
      </div>
    </div>
  );
};

export default App;
