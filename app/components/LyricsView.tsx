import React, { memo, useEffect, useRef } from 'react';
import { SongState } from '../types';

interface LyricsViewProps {
  lyrics: SongState['lyrics'];
  isLoading: boolean;
  activeLyricIndex: number;
  autoScrollEnabled: boolean;
  stopAutoScroll: () => void;
  resumeAutoScroll: () => void;
  lyricsContainerRef: React.RefObject<HTMLDivElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
  file: File | null; // Needed for "No Lyrics Found" vs "Select a Track"
  hasStarted: boolean;
  currentTime: number; // Current playback time for start state detection
}

export const LyricsView = memo(({
  lyrics,
  isLoading,
  activeLyricIndex,
  autoScrollEnabled,
  stopAutoScroll,
  resumeAutoScroll,
  lyricsContainerRef,
  audioRef,
  file,
  hasStarted,
  currentTime
}: LyricsViewProps) => {
  // Track previous time to detect seeking to start
  const prevTimeRef = useRef(currentTime);
  const wasAtStartRef = useRef(false);
  
  // Reset scroll when seeking to near start - more aggressive detection
  useEffect(() => {
    const prevTime = prevTimeRef.current;
    prevTimeRef.current = currentTime;
    
    // Reset scroll if:
    // 1. We jumped backward by more than 3 seconds to near start (<3s)
    // 2. OR we just entered start state (currentTime < 2 but wasn't before)
    const bigJumpToStart = (prevTime - currentTime > 3) && currentTime < 3;
    const justEnteredStart = currentTime < 2 && prevTime >= 2;
    
    if (bigJumpToStart || justEnteredStart) {
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
      }
    }
  }, [currentTime, lyricsContainerRef]);
  
  // Check if we have lyrics to show
  const hasLyrics = lyrics.synced.length > 0 || lyrics.plain.length > 0;

  // Only show loading if we are loading AND don't have lyrics yet
  // This prevents the "Loading" screen from hiding lyrics while audio buffers
  if (isLoading && !hasLyrics) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6">
        <div className="loading-spinner"></div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-medium">
          Loading Lyrics
        </p>
      </div>
    );
  }

  if (lyrics.isSynced) {
    // Calculate lyric index directly from currentTime for reliability
    // This makes the component self-sufficient during fast seeking
    const calculateIndexFromTime = () => {
      if (currentTime < 2) return -1; // Start state for first 2 seconds
      
      // Find the last lyric that should be active at currentTime
      const adjustedTime = currentTime + 0.2; // 200ms ahead for sync feel
      for (let i = lyrics.synced.length - 1; i >= 0; i--) {
        if (lyrics.synced[i].time <= adjustedTime) {
          return i;
        }
      }
      return -1;
    };
    
    // Use calculated index as primary
    const calculatedIndex = calculateIndexFromTime();
    const effectiveIndex = calculatedIndex;
    const isAtStart = effectiveIndex === -1;

    // FORCE scroll to top on EVERY render when at start state
    // This is intentionally aggressive to ensure correct position
    if (isAtStart && lyricsContainerRef.current && lyricsContainerRef.current.scrollTop !== 0) {
      lyricsContainerRef.current.scrollTop = 0;
    }

    // Use consistent offset for both CSS and scroll calculations
    const LYRICS_TOP_OFFSET = '26vh';

    return (
      <div className="relative h-full w-full">
        <div
          ref={lyricsContainerRef}
          className="h-full w-full overflow-y-auto lyrics-scroll pb-[50vh] pl-2 pr-6 md:pl-4 md:pr-12 relative will-change-scroll"
          style={{ 
            paddingTop: LYRICS_TOP_OFFSET,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 90%, transparent 100%)', 
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 90%, transparent 100%)' 
          }}
          onWheel={stopAutoScroll}
          onTouchMove={stopAutoScroll}
        >
          {lyrics.synced.map((line, idx) => {
            const distance = idx - effectiveIndex;
            const isActive = idx === effectiveIndex;

            let opacityClass = "opacity-0";
            let blurClass = "blur-0";
            let scaleClass = "scale-95";
            let pointerEvents = "pointer-events-none";

            // PRIORITY 1: Start state - always show first 4 lyrics regardless of other conditions
            if (isAtStart && idx < 4) {
              if (idx === 0) {
                opacityClass = "opacity-100";
                scaleClass = "scale-105";
              } else if (idx === 1) {
                opacityClass = "opacity-90";
                scaleClass = "scale-100";
              } else if (idx === 2) {
                opacityClass = "opacity-80";
                scaleClass = "scale-100";
              } else {
                opacityClass = "opacity-60";
                scaleClass = "scale-100";
              }
              blurClass = "blur-0";
              pointerEvents = "pointer-events-auto";
            }
            // PRIORITY 2: Active lyric (when not at start)
            else if (isActive) {
              opacityClass = "opacity-100";
              scaleClass = "scale-110";
              pointerEvents = "pointer-events-auto";
              blurClass = "blur-0";
            }
            // PRIORITY 3: User browsing mode (auto-scroll disabled)
            else if (!autoScrollEnabled) {
              const absDist = Math.abs(distance);
              if (absDist <= 1) opacityClass = "opacity-100";
              else if (absDist <= 4) opacityClass = "opacity-75"; 
              else opacityClass = "opacity-40";
              
              scaleClass = "scale-100";
              pointerEvents = "pointer-events-auto";
            }
            // PRIORITY 4: Normal playback mode
            else {
              if (distance === -1) {
                // Just passed - fade out
                opacityClass = "opacity-0"; 
                scaleClass = "scale-95";
                blurClass = "blur-sm";
              } else if (distance > 0 && distance <= 3) {
                if (distance === 1) {
                  opacityClass = "opacity-80";
                  blurClass = "blur-[0.5px]";
                } else if (distance === 2) {
                  opacityClass = "opacity-60";
                  blurClass = "blur-[1px]";
                } else if (distance === 3) {
                  opacityClass = "opacity-40";
                  blurClass = "blur-[1.5px]";
                }
                scaleClass = "scale-100";
                pointerEvents = "pointer-events-auto";
              }
              // Else: opacity-0 (hidden)
            }

            return (
              <div
                key={idx}
                onClick={() =>
                  audioRef.current &&
                  (audioRef.current.currentTime = line.time)
                }
                className={`lyric-item my-4 md:my-6 text-3xl md:text-4xl cursor-pointer select-none transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] transform-gpu ${
                  isActive ? "active-lyric" : ""
                } ${opacityClass} ${blurClass} ${scaleClass} ${pointerEvents}`}
              >
                {line.text || "♪"}
              </div>
            );
          })}
        </div>

        {/* Resume Sync Button */}
        {!autoScrollEnabled && (
          <button 
            onClick={resumeAutoScroll}
            className="absolute bottom-8 right-8 z-50 bg-black/50 text-white backdrop-blur-md px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-black/70 transition-all border border-white/10 shadow-lg animate-in fade-in slide-in-from-bottom-4"
          >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
             Resume Sync
          </button>
        )}
      </div>
    );
  }

  if (hasLyrics) {
    return (
      <div
        ref={lyricsContainerRef}
        className="h-full w-full overflow-y-auto lyrics-scroll py-10 px-6 md:px-12"
      >
        <div className="flex flex-col">
          {lyrics.plain.map((line, idx) => (
            <div
              key={idx}
              className="plain-lyric text-base md:text-lg tracking-wide"
            >
              {line || <span className="text-white/20">♪</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No Lyrics
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <svg
        className="w-12 h-12 text-white/10"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
      <p className="text-white/20 text-xs uppercase tracking-[0.3em]">
        {file ? "No Lyrics Found" : "Select a Track"}
      </p>
    </div>
  );
});

LyricsView.displayName = "LyricsView";
