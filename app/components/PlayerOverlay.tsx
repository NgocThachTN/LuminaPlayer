
import React from 'react';
import { PlaylistItem, SongState } from '../types';
import { adjustBrightness, ensureDarkColor, getColorPalette, hexToRgbString, mixColors } from '../../services/colorService';
import { LyricsView } from './LyricsView';

interface PlayerOverlayProps {
  state: SongState;
  audioInfo: { format: string; bitrate: number | null };
  dominantColor: string;
  isLdacSupported: boolean;
  isFullScreenPlayer: boolean;
  isFullscreenTransitioning: boolean;
  setIsFullScreenPlayer: (v: boolean) => void;
  showLyrics: boolean;
  setShowLyrics: (v: boolean) => void;
  openLyricsFullscreen: () => void;
  exitLyricsFullscreen: () => void;
  isDocumentFullscreen: boolean;
  showVolumePopup: boolean;
  setShowVolumePopup: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  queueItems: PlaylistItem[];
  onQueueItemSelect: (index: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  setState: React.Dispatch<React.SetStateAction<SongState>>;
  
  // From useLyrics hook
  lyricsContainerRef: React.RefObject<HTMLDivElement>;
  activeLyricIndex: number;
  autoScrollEnabled: boolean;
  stopAutoScroll: () => void;
  resumeAutoScroll: () => void;
  resetLyricsLayout: () => void;
  isLoading: boolean;
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

type AmbientPalette = {
  base: string;
  baseLift: string;
  primary: string;
  secondary: string;
  accent: string;
  highlight: string;
  glow: string;
  shadow: string;
};

const buildAmbientPalette = (dominantColor: string, coverPalette: string[]): AmbientPalette => {
  const palette = coverPalette.length ? coverPalette : [dominantColor];
  const seed = dominantColor || palette[0] || '#171717';
  const safeBase = ensureDarkColor(seed, 0.16) || '#171717';
  const base = mixColors(safeBase, '#040404', 0.42);
  const primarySeed = palette[0] || seed;
  const secondarySeed = palette[1] || adjustBrightness(primarySeed, 0.06);
  const accentSeed = palette[2] || palette[1] || adjustBrightness(primarySeed, 0.14);

  const primary = mixColors(ensureDarkColor(primarySeed, 0.22), base, 0.28);
  const secondary = mixColors(ensureDarkColor(secondarySeed, 0.24), base, 0.36);
  const accent = mixColors(ensureDarkColor(accentSeed, 0.28), primary, 0.32);
  const baseLift = mixColors(base, primary, 0.24);
  const highlight = mixColors(adjustBrightness(primary, 0.12), '#f4f1dc', 0.12);
  const glow = mixColors(adjustBrightness(accent, 0.16), highlight, 0.32);
  const shadow = mixColors(adjustBrightness(base, -0.18), '#000000', 0.46);

  return { base, baseLift, primary, secondary, accent, highlight, glow, shadow };
};

interface QueueViewProps {
  items: PlaylistItem[];
  currentSongIndex: number;
  activeCover?: string;
  onSelect: (index: number) => void;
}

const parseTrackFromName = (name: string) => {
  const base = name.replace(/\.[^/.]+$/, "");
  const dashIndex = base.indexOf(" - ");
  if (dashIndex > 0) {
    return {
      artist: base.slice(0, dashIndex).trim(),
      title: base.slice(dashIndex + 3).trim(),
    };
  }
  return { artist: "Unknown Artist", title: base };
};

const QueueView: React.FC<QueueViewProps> = ({ items, currentSongIndex, activeCover, onSelect }) => {
  return (
    <div className="h-full w-full overflow-y-auto lyrics-scroll px-6 py-8 md:px-10 md:py-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-normal">Playlist</h2>
        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/35">
          {items.length} tracks
        </p>
      </div>

      {items.length === 0 ? (
        <div className="h-[60%] flex flex-col items-center justify-center gap-4 text-white/25">
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 6h12v2H4V6zm0 5h12v2H4v-2zm0 5h8v2H4v-2zm14-4.5V6h2v5.5c.6-.35 1.3-.5 2-.5v2c-1.1 0-2 .9-2 2v1c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3c.35 0 .69.06 1 .17V11.5z" />
          </svg>
          <p className="text-xs uppercase tracking-[0.3em]">No Tracks</p>
        </div>
      ) : (
        <div className="space-y-2 pb-12">
          {items.map((item, index) => {
            const metadata = item.metadata;
            const parsed = parseTrackFromName(item.name);
            const title = metadata?.title && metadata.title !== "Unknown Title" ? metadata.title : parsed.title;
            const artist = metadata?.artist && metadata.artist !== "Unknown Artist" ? metadata.artist : parsed.artist;
            const album = metadata?.album || "Unknown Album";
            const isActive = index === currentSongIndex;
            const cover = metadata?.cover || (isActive ? activeCover : undefined);

            return (
              <button
                key={`${item.path || item.name}-${index}`}
                onClick={() => onSelect(index)}
                className={`w-full min-w-0 flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive ? 'bg-white/12 text-white' : 'text-white/62 hover:bg-white/8 hover:text-white'
                }`}
              >
                <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden bg-white/8 border border-white/8 flex items-center justify-center">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5 text-white/25" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f1c40f] shrink-0" />
                    )}
                    <p className="truncate text-sm font-semibold leading-tight">{title}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/42">
                    {artist} <span className="mx-1 opacity-60">-</span> {album}
                  </p>
                </div>

                <span className="w-8 shrink-0 text-right text-[11px] text-white/30">
                  {metadata?.duration ? formatTime(metadata.duration) : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PlayerOverlayBase: React.FC<PlayerOverlayProps> = ({
  state,
  audioInfo,
  dominantColor,
  isLdacSupported,
  isFullScreenPlayer,
  isFullscreenTransitioning,
  setIsFullScreenPlayer,
  showLyrics,
  setShowLyrics,
  openLyricsFullscreen,
  exitLyricsFullscreen,
  isDocumentFullscreen,
  showVolumePopup,
  setShowVolumePopup,
  volume,
  setVolume,
  togglePlay,
  playNext,
  playPrevious,
  queueItems,
  onQueueItemSelect,
  audioRef,
  setState,
  lyricsContainerRef,
  activeLyricIndex,
  autoScrollEnabled,
  stopAutoScroll,
  resumeAutoScroll,
  resetLyricsLayout,
  isLoading,
  hasStarted,
  setViewMode,
  setIsRestoringLayout,
  viewMode
}) => {
  const PANEL_FADE_MS = 220;

  const [coverPalette, setCoverPalette] = React.useState<string[]>([]);
  const [showQueue, setShowQueue] = React.useState(false);
  const [renderLyricsPanel, setRenderLyricsPanel] = React.useState(showLyrics);
  const [renderQueuePanel, setRenderQueuePanel] = React.useState(showQueue);
  const [lyricsPanelReady, setLyricsPanelReady] = React.useState(!showLyrics);
  const isSidePanelOpen = showLyrics || showQueue;
  const isLyricsPanelVisible = isSidePanelOpen && showLyrics;
  const isQueuePanelVisible = isSidePanelOpen && showQueue;
  const sidePanelRef = React.useRef<HTMLDivElement>(null);
  const wasSidePanelOpenRef = React.useRef(isSidePanelOpen);
  const prevShowLyricsRef = React.useRef(showLyrics);
  const prevIsFullScreenPlayerRef = React.useRef(isFullScreenPlayer);

  React.useEffect(() => {
    let cancelled = false;

    if (!state.metadata.cover) {
      setCoverPalette([]);
      return;
    }

    getColorPalette(state.metadata.cover, 6).then((palette) => {
      if (!cancelled) {
        setCoverPalette(palette);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [state.metadata.cover]);

  const ambientPalette = React.useMemo(() =>
    buildAmbientPalette(dominantColor, coverPalette),
  [dominantColor, coverPalette]);

  const overlayColumnTransitionStyle = React.useMemo(() => ({
    transitionProperty: 'flex-basis, opacity',
    transitionDuration: '320ms, 220ms',
    transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1), ease-out',
    willChange: 'flex-basis, opacity',
  } as React.CSSProperties), []);

  const playerBackgroundStyle = React.useMemo(() => ({
    backgroundColor: ambientPalette.base,
    '--cover-bg-base': ambientPalette.base,
    '--cover-bg-base-lift': ambientPalette.baseLift,
    '--cover-bg-primary': ambientPalette.primary,
    '--cover-bg-secondary': ambientPalette.secondary,
    '--cover-bg-accent': ambientPalette.accent,
    '--cover-bg-highlight': ambientPalette.highlight,
    '--cover-bg-glow': ambientPalette.glow,
    '--cover-bg-shadow': ambientPalette.shadow,
    '--cover-bg-primary-rgb': hexToRgbString(ambientPalette.primary),
    '--cover-bg-secondary-rgb': hexToRgbString(ambientPalette.secondary),
    '--cover-bg-accent-rgb': hexToRgbString(ambientPalette.accent),
    '--cover-bg-highlight-rgb': hexToRgbString(ambientPalette.highlight),
    '--cover-bg-glow-rgb': hexToRgbString(ambientPalette.glow),
  } as React.CSSProperties), [ambientPalette]);

  React.useEffect(() => {
    wasSidePanelOpenRef.current = isSidePanelOpen;
  }, [isSidePanelOpen]);

  // Hold the lyrics text until the side panel has a stable width, then reveal it in-place.
  React.useLayoutEffect(() => {
    const justOpenedLyrics = showLyrics && !prevShowLyricsRef.current;
    const justOpenedOverlayWithLyrics = showLyrics && isFullScreenPlayer && !prevIsFullScreenPlayerRef.current;

    prevShowLyricsRef.current = showLyrics;
    prevIsFullScreenPlayerRef.current = isFullScreenPlayer;

    if (!showLyrics) {
      setLyricsPanelReady(false);
      return;
    }

    if (!justOpenedLyrics && !justOpenedOverlayWithLyrics) {
      return;
    }

    let isCancelled = false;
    let revealRafOne: number | null = null;
    let revealRafTwo: number | null = null;
    let fallbackTimer: number | null = null;
    const sidePanel = sidePanelRef.current;
    const shouldWaitForPanelSettle = !wasSidePanelOpenRef.current || justOpenedOverlayWithLyrics;

    setLyricsPanelReady(false);

    const revealLyricsPanel = () => {
      if (isCancelled) return;

      resetLyricsLayout();
      revealRafOne = window.requestAnimationFrame(() => {
        revealRafOne = null;
        revealRafTwo = window.requestAnimationFrame(() => {
          revealRafTwo = null;
          if (!isCancelled) {
            setLyricsPanelReady(true);
          }
        });
      });
    };

    if (!sidePanel || !shouldWaitForPanelSettle) {
      revealLyricsPanel();
    } else {
      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== sidePanel || event.propertyName !== 'flex-basis') {
          return;
        }

        sidePanel.removeEventListener('transitionend', handleTransitionEnd);
        revealLyricsPanel();
      };

      sidePanel.addEventListener('transitionend', handleTransitionEnd);
      fallbackTimer = window.setTimeout(() => {
        sidePanel.removeEventListener('transitionend', handleTransitionEnd);
        revealLyricsPanel();
      }, 380);

      return () => {
        isCancelled = true;
        sidePanel.removeEventListener('transitionend', handleTransitionEnd);
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
        }
        if (revealRafOne !== null) {
          window.cancelAnimationFrame(revealRafOne);
        }
        if (revealRafTwo !== null) {
          window.cancelAnimationFrame(revealRafTwo);
        }
      };
    }

    return () => {
      isCancelled = true;
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
      if (revealRafOne !== null) {
        window.cancelAnimationFrame(revealRafOne);
      }
      if (revealRafTwo !== null) {
        window.cancelAnimationFrame(revealRafTwo);
      }
    };
  }, [isFullScreenPlayer, showLyrics, resetLyricsLayout]);

  // Fix: Close volume popup when collapsing player
  React.useEffect(() => {
    if (!isFullScreenPlayer && showVolumePopup) {
      setShowVolumePopup(false);
    }
  }, [isFullScreenPlayer, showVolumePopup, setShowVolumePopup]);

  React.useEffect(() => {
    if (showLyrics) {
      setShowQueue(false);
    }
  }, [showLyrics]);

  React.useEffect(() => {
    if (showLyrics) {
      setRenderLyricsPanel(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setRenderLyricsPanel(false);
    }, PANEL_FADE_MS);

    return () => window.clearTimeout(timer);
  }, [showLyrics]);

  React.useEffect(() => {
    if (showQueue) {
      setRenderQueuePanel(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setRenderQueuePanel(false);
    }, PANEL_FADE_MS);

    return () => window.clearTimeout(timer);
  }, [showQueue]);

  React.useEffect(() => {
    if (!isLyricsPanelVisible || !renderLyricsPanel || !lyricsPanelReady) {
      return;
    }

    let rafOne: number | null = null;
    let rafTwo: number | null = null;

    rafOne = window.requestAnimationFrame(() => {
      rafOne = null;
      rafTwo = window.requestAnimationFrame(() => {
        rafTwo = null;
        resetLyricsLayout();
      });
    });

    return () => {
      if (rafOne !== null) {
        window.cancelAnimationFrame(rafOne);
      }
      if (rafTwo !== null) {
        window.cancelAnimationFrame(rafTwo);
      }
    };
  }, [isDocumentFullscreen, isLyricsPanelVisible, lyricsPanelReady, renderLyricsPanel, resetLyricsLayout]);

  return (
    <>
    <div 
      className={`fixed inset-0 z-[60] flex flex-col md:flex-row transform-gpu will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isFullScreenPlayer ? 'translate-y-0' : 'translate-y-full'}`}
      style={playerBackgroundStyle}
    >
       <div 
         className={`lumina-ambient-background absolute inset-0 z-0 overflow-hidden ${state.isPlaying ? 'lumina-ambient-playing' : ''} ${isFullscreenTransitioning ? 'lumina-ambient-transitioning' : ''}`}
         aria-hidden="true"
       >
         {state.metadata.cover && (
           <>
           <img 
             src={state.metadata.cover}
             alt=""
             className="lumina-cover-field"
           />
           <img 
             src={state.metadata.cover}
             alt=""
             className="lumina-cover-wash"
           />
           </>
         )}
         <div className="lumina-ambient-mesh" />
         <div className="lumina-ambient-depth" />
         <div className="lumina-ambient-grain" />
         <div className="lumina-ambient-readability" />
         <div className="lumina-ambient-tone-balance" />
       </div>
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
       <div
         className="h-full min-w-0 flex w-full flex-col items-center justify-center relative bg-transparent z-20"
         style={{
           ...overlayColumnTransitionStyle,
           flexBasis: isSidePanelOpen ? '45%' : '100%',
           flexGrow: isSidePanelOpen ? 0 : 1,
           flexShrink: 0,
         }}
       >

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

         <div className="w-full max-w-[440px] mx-auto mt-2 relative h-20">
            {/* Volume Control */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <div className="relative">
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

              <button
                onClick={() => {
                  setShowQueue((current) => !current);
                  setShowLyrics(false);
                }}
                className={`transition-all duration-200 p-2 rounded-lg ${showQueue ? 'text-white bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                title={showQueue ? "Hide Playlist" : "Show Playlist"}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h12v2H4V6zm0 5h12v2H4v-2zm0 5h8v2H4v-2zm14-4.5V6h2v5.5c.6-.35 1.3-.5 2-.5v2c-1.1 0-2 .9-2 2v1c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3c.35 0 .69.06 1 .17V11.5zM17 17c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
                </svg>
              </button>
            </div>

            {/* Center Controls */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid grid-cols-[36px_48px_72px_48px_36px] items-center justify-items-center gap-2">
              {/* Shuffle */}
              <button 
                onClick={() => setState(prev => ({ ...prev, isShuffle: !prev.isShuffle }))}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${state.isShuffle ? 'text-[#f1c40f]' : 'text-white/50 hover:text-white'}`}
                title="Shuffle"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
              </button>

              {/* Prev */}
              <button onClick={playPrevious} className="w-12 h-12 flex items-center justify-center text-white hover:text-white/80 transition-colors">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>

              {/* Play/Pause */}
              <button 
                onClick={togglePlay} 
                className="w-[72px] h-[72px] flex items-center justify-center text-white hover:scale-110 transition-transform drop-shadow-lg"
              >
                {state.isPlaying ? (
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>

              {/* Next */}
              <button onClick={playNext} className="w-12 h-12 flex items-center justify-center text-white hover:text-white/80 transition-colors">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
              </button>

              {/* Repeat */}
              <button 
                onClick={() => setState(prev => {
                  const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
                  const nextIndex = (modes.indexOf(prev.repeatMode) + 1) % modes.length;
                  return { ...prev, repeatMode: modes[nextIndex] };
                })}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${state.repeatMode !== 'off' ? 'text-[#f1c40f]' : 'text-white/50 hover:text-white'}`}
                title={`Repeat: ${state.repeatMode}`}
              >
                {state.repeatMode === 'one' ? (
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v6z"/><text x="12" y="16" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor">1</text></svg>
                ) : (
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v6z"/></svg>
                )}
              </button>
            </div>

            {/* Lyrics/Fullscreen Buttons */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={isDocumentFullscreen ? exitLyricsFullscreen : openLyricsFullscreen}
                  className="transition-all duration-200 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                  title={isDocumentFullscreen ? "Exit Fullscreen" : "Fullscreen Lyrics"}
                >
                  {isDocumentFullscreen ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 7H3V5h6v6H7V7zm10 0v4h-2V5h6v2h-4zM7 17v-4h2v6H3v-2h4zm10 0h4v2h-6v-6h2v4z"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5h6V3H3v8h2V5zm8-2v2h6v6h2V3h-8zM5 13H3v8h8v-2H5v-6zm14 6h-6v2h8v-8h-2v6z"/></svg>
                  )}
                </button>
                <button 
                  onClick={() => {
                    setShowQueue(false);
                    setShowLyrics(!showLyrics);
                  }}
                  className={`transition-all duration-200 p-2 rounded-lg ${showLyrics ? 'text-white bg-white/10' : 'text-white/50 hover:text-white'}`}
                  title={showLyrics ? "Hide Lyrics" : "Show Lyrics"}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                </button>
            </div>
         </div>
      </div>
    </div>
      
      {/* Right Side of Overlay: lyrics/queue fade only to avoid missed renders */}
      <div
        ref={sidePanelRef}
        className={`md:flex h-full min-w-0 flex-col relative bg-transparent overflow-hidden ${isSidePanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{
          ...overlayColumnTransitionStyle,
          flexBasis: isSidePanelOpen ? '55%' : '0%',
          flexGrow: isSidePanelOpen ? 1 : 0,
          flexShrink: 0,
        }}
      >
        <div
          className={`relative z-10 h-full w-full transition-opacity duration-220 ease-out ${isSidePanelOpen ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transitionDelay: isSidePanelOpen ? '60ms' : '0ms',
          }}
        >
          <div
            className={`absolute inset-0 transition-opacity duration-180 ease-out ${isQueuePanelVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={!isQueuePanelVisible}
          >
            {renderQueuePanel && (
              <div
                className={`h-full w-full transition-opacity duration-150 ease-out ${
                  isQueuePanelVisible
                    ? 'opacity-100'
                    : 'opacity-0'
                }`}
              >
                <QueueView
                  items={queueItems}
                  currentSongIndex={state.currentSongIndex}
                  activeCover={state.metadata.cover}
                  onSelect={onQueueItemSelect}
                />
              </div>
            )}
          </div>

          <div
            className={`absolute inset-0 transition-opacity duration-220 ease-out ${isLyricsPanelVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            aria-hidden={!isLyricsPanelVisible}
          >
            {renderLyricsPanel && (
              <div
                className={`h-full w-full transition-opacity duration-150 ease-out ${
                  isLyricsPanelVisible && lyricsPanelReady
                    ? 'opacity-100'
                    : 'opacity-0'
                }`}
                style={{
                  visibility: isLyricsPanelVisible && lyricsPanelReady ? 'visible' : 'hidden',
                }}
              >
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
                  dominantColor={dominantColor}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export const PlayerOverlay = React.memo(PlayerOverlayBase);
