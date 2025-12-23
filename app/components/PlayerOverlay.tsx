
import React from 'react';
import { SongState, SongMetadata } from '../types';
import { ensureDarkColor } from '../../services/colorService';
import { LyricsView } from './LyricsView';

interface PlayerOverlayProps {
  state: SongState;
  audioInfo: { format: string; bitrate: number | null };
  dominantColor: string;
  isLdacSupported: boolean;
  isFullScreenPlayer: boolean;
  setIsFullScreenPlayer: (v: boolean) => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean) => void;
  showVolumePopup: boolean;
  setShowVolumePopup: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  setState: React.Dispatch<React.SetStateAction<SongState>>;
  
  // From useLyrics hook
  lyricsContainerRef: React.RefObject<HTMLDivElement>;
  activeLyricIndex: number;
  autoScrollEnabled: boolean;
  stopAutoScroll: () => void;
  resumeAutoScroll: () => void;
  isLoading: boolean;
  scrollToActiveLine: () => void;
  hasStarted: boolean;
  
  // UI helpers
  setViewMode: (mode: any) => void;
  setIsRestoringLayout: (v: boolean) => void;
  viewMode: string;
}

// Helper outside component
const formatTime = (time: number) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({
  state,
  audioInfo,
  dominantColor,
  isLdacSupported,
  isFullScreenPlayer,
  setIsFullScreenPlayer,
  showLyrics,
  setShowLyrics,
  showVolumePopup,
  setShowVolumePopup,
  volume,
  setVolume,
  togglePlay,
  playNext,
  playPrevious,
  audioRef,
  setState,
  lyricsContainerRef,
  activeLyricIndex,
  autoScrollEnabled,
  stopAutoScroll,
  resumeAutoScroll,
  isLoading,
  scrollToActiveLine,
  hasStarted,
  setViewMode,
  setIsRestoringLayout,
  viewMode
}) => {

  const bgColor = React.useMemo(() => 
    ensureDarkColor(dominantColor, 0.2) || '#171717',
  [dominantColor]);

  // Scroll to active line when opening lyrics - instant scroll to prevent jump
  React.useLayoutEffect(() => {
    if (showLyrics && scrollToActiveLine && autoScrollEnabled) {
       // Scroll instantly when opening to prevent visual jump
       scrollToActiveLine(true); // true = instant
    }
  }, [showLyrics, scrollToActiveLine, autoScrollEnabled]);

  return (
    <>
    <div 
      className={`fixed inset-0 z-[60] flex flex-col md:flex-row transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isFullScreenPlayer ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ backgroundColor: bgColor }} 
    >
       {/* Apple Music Style Blurred Album Background */}
       {state.metadata.cover && (
         <div 
           className="absolute inset-0 z-0 overflow-hidden"
           aria-hidden="true"
         >
           {/* Base layer - heavily blurred album art */}
           <div 
             className="absolute inset-[-150px] bg-cover bg-center transition-all duration-[1500ms] ease-out"
             style={{ 
               backgroundImage: `url(${state.metadata.cover})`,
               filter: 'blur(120px) saturate(1.4) brightness(0.6)',
               transform: 'scale(1.5)',
             }}
           />
           {/* Color accent layer - adds depth and vibrancy */}
           <div 
             className="absolute inset-[-80px] bg-cover bg-center mix-blend-overlay opacity-60 transition-all duration-[1500ms]"
             style={{ 
               backgroundImage: `url(${state.metadata.cover})`,
               filter: 'blur(80px) saturate(1.6)',
               transform: 'scale(1.3)',
             }}
           />
           {/* Subtle grain for smooth color transitions */}
           <div 
             className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
             }}
           />
           {/* Vignette overlay - Apple Music style darkening at edges */}
           <div 
             className="absolute inset-0"
             style={{
               background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%)',
             }}
           />
           {/* Top-to-bottom gradient for content readability - Darker for accessibility */}
           <div className="absolute inset-0 bg-black/30 mix-blend-multiply" />
           <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
         </div>
       )}
       {/* Collapse Button */}
       <button 
         onClick={() => {
           setIsFullScreenPlayer(false);
           if (viewMode === 'lyrics') {
              setIsRestoringLayout(true);
              setViewMode('albums');
              
              setTimeout(() => {
                setIsRestoringLayout(false);
              }, 700);
           }
         }}
         className="absolute top-6 left-6 z-50 p-2 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all"
         title="Collapse to Mini Player"
       >
         <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
       </button>

       {/* Left Column Wrapper - smooth scale transition */}
       <div className={`h-full flex flex-col relative bg-transparent z-20 transform-gpu transition-transform duration-300 ease-out items-center justify-center ${showLyrics ? 'w-full md:flex-[0_0_45%] scale-[0.98]' : 'w-full md:flex-[1_0_100%] scale-100'}`}>

      {/* Top: Album Art */}
      <div className="w-full flex-none flex items-center justify-center p-8 pb-10">
        <div className="album-cover-container relative w-full max-w-[360px] aspect-square">
          {/* Vinyl record effect */}
          <div
            className={`vinyl-record ${
              state.isPlaying && isFullScreenPlayer ? "vinyl-spinning" : ""
            }`}
          ></div>

          {/* Album cover */}
          <div className="album-cover w-full h-full bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center shadow-2xl relative z-10">
            {state.metadata.cover ? (
              <img
                src={state.metadata.cover}
                className="w-full h-full object-cover"
                alt="Cover Art"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                <svg
                  className="w-20 h-20 text-white/10"
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

      {/* Bottom: Controls & Info */}
      <div className="w-full px-10 z-20 mt-0">
         {/* Song Info & Metadata */}
         <div className="flex flex-col items-center gap-0.5 mb-6 w-full">
           <div className="flex items-center justify-center w-full px-4">
             <h2 className="text-xl md:text-2xl font-bold leading-tight text-white text-center drop-shadow-md">
                {state.metadata.title || "No Title"}
             </h2>
           </div>
           
           <p className="text-white/60 text-sm md:text-base font-medium tracking-wide text-center">
              {state.metadata.artist || "Unknown Artist"} <span className="opacity-60 mx-1">—</span> {state.metadata.album || "Unknown Album"}
           </p>

           {/* Only show badge for Lossless formats */}
           {['FLAC', 'WAV', 'AIFF', 'ALAC'].includes(audioInfo.format || "") && (
             <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-bold text-neutral-400 border border-neutral-600 rounded px-1 py-0.5 tracking-wider uppercase scale-90">
                  {audioInfo.format}
               </span>
               {isLdacSupported && (
                  <span className="text-[10px] font-bold text-[#f1c40f] border border-[#f1c40f] rounded px-1.5 py-0.5 tracking-wider uppercase scale-90">
                     LDAC
                  </span>
               )}
             </div>
           )}
         </div>

         {/* Progress Bar Container */}
         <div className="w-full max-w-[440px] mx-auto mb-6 flex items-center gap-3 text-xs font-medium text-white/50 font-mono">
             <span className="w-8 text-right">{formatTime(state.currentTime)}</span>
             
             <div className="flex-1 h-1 bg-white/10 rounded-full relative cursor-pointer overflow-visible group">
                 <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full"
                    style={{ width: `${(state.currentTime / state.duration) * 100 || 0}%` }}
                 ></div>
                 {/* Handle */}
                 <div 
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity intro-yScale"
                    style={{ left: `${(state.currentTime / state.duration) * 100 || 0}%`, transform: 'translate(-50%, -50%)' }}
                 ></div>
                 
                 <input
                   type="range"
                   min="0"
                   max={state.duration || 0}
                   step="0.1"
                   value={state.currentTime}
                   onChange={(e) => {
                     const time = Number(e.target.value);
                     if (audioRef.current) audioRef.current.currentTime = time;
                     setState((prev) => ({ ...prev, currentTime: time }));
                   }}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                 />
             </div>
             
             <span className="w-8 text-left">-{formatTime((state.duration || 0) - state.currentTime)}</span>
         </div>

         <div className="w-full max-w-[440px] mx-auto mt-2 flex items-center justify-between relative">
            {/* Volume Control */}
            <div className="flex-none relative">
                <button 
                  onClick={() => setShowVolumePopup(!showVolumePopup)}
                  onWheel={(e) => {
                    const step = 0.05;
                    const newVolume = volume + (e.deltaY < 0 ? step : -step);
                    setVolume(Math.min(1, Math.max(0, newVolume)));
                  }}
                  className="text-white/50 hover:text-white transition-colors p-2"
                  title="Volume (Scroll to adjust)"
                >
                  {volume === 0 ? (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                  ) : volume < 0.5 ? (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                  ) : (
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L9 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  )}
                </button>
                
                {/* Volume Popup */}
                {showVolumePopup && (
                  <>
                    <div className="fixed inset-0 z-[100] cursor-default" onClick={(e) => { e.stopPropagation(); setShowVolumePopup(false); }}></div>
                    
                    <div 
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 h-10 bg-[#1e1e1e]/90 backdrop-blur-xl rounded-2xl flex items-center px-3 gap-2 z-[101] shadow-xl border border-white/5 popup-animate"
                      onClick={(e) => e.stopPropagation()} 
                    >
                      <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                        {volume === 0 ? (
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        ) : (
                          <path d="M3 9v6h4l5 5V4L9 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        )}
                      </svg>

                      <div className="relative flex-1 h-1 bg-white/20 rounded-full group">
                          <div 
                              className="absolute top-0 left-0 h-full bg-white rounded-full"
                              style={{ width: `${volume * 100}%` }}
                          ></div>
                          <div 
                              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ left: `${volume * 100}%`, transform: 'translate(-50%, -50%)' }}
                          ></div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                      </div>
                    </div>
                  </>
                )}
            </div>

            {/* Center Controls */}
            <div className="flex items-center justify-center gap-6">
              {/* Shuffle */}
              <button className="text-white/50 hover:text-white transition-colors p-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
              </button>

              {/* Prev */}
              <button onClick={playPrevious} className="text-white hover:text-white/80 transition-colors p-2">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>

              {/* Play/Pause */}
              <button 
                onClick={togglePlay} 
                className="text-white hover:scale-110 transition-transform p-2 drop-shadow-lg"
              >
                {state.isPlaying ? (
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              {/* Next */}
              <button onClick={playNext} className="text-white hover:text-white/80 transition-colors p-2">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
              </button>

              {/* Repeat */}
              <button className="text-white/50 hover:text-white transition-colors p-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v6z"/></svg>
              </button>
            </div>

            {/* Lyrics/Queue Button */}
            <div className="flex-none">
                <button 
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`transition-all duration-200 p-2 rounded-lg ${showLyrics ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                  title={showLyrics ? "Hide Lyrics" : "Show Lyrics"}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                </button>
            </div>
         </div>
      </div>
    </div>
      
      {/* Right Side of Overlay: Lyrics - smooth fade and scale */}
      <div className={`md:flex h-full flex-col relative bg-transparent transform-gpu overflow-hidden ${showLyrics ? 'flex-[1_0_55%]' : 'flex-[0_0_0px]'}`}>
        <div className={`h-full w-full transform-gpu transition-all duration-300 ease-out ${showLyrics ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-8 scale-95'}`}>


          <LyricsView 
            lyrics={state.lyrics}
            isLoading={isLoading}
            activeLyricIndex={activeLyricIndex}
            autoScrollEnabled={autoScrollEnabled}
            stopAutoScroll={stopAutoScroll}
            resumeAutoScroll={resumeAutoScroll}
            lyricsContainerRef={lyricsContainerRef}
            audioRef={audioRef}
            file={state.file}
            hasStarted={hasStarted}
            currentTime={state.currentTime}
            dominantColor={dominantColor}
          />

        </div>
      </div>
    </div>
    </>
  );
};