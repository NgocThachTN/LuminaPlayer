import React, { memo } from 'react';
import { SongState } from '../types';

interface LyricsViewProps {
  lyrics: SongState['lyrics'];
  isLoading: boolean;
  activeLyricIndex: number;
  isUserScrolling: boolean;
  setIsUserScrolling: (v: boolean) => void;
  userScrollTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  lyricsContainerRef: React.RefObject<HTMLDivElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
  file: File | null; // Needed for "No Lyrics Found" vs "Select a Track"
}

export const LyricsView = memo(({
  lyrics,
  isLoading,
  activeLyricIndex,
  isUserScrolling,
  setIsUserScrolling,
  userScrollTimeoutRef,
  lyricsContainerRef,
  audioRef,
  file
}: LyricsViewProps) => {
  const hasLyrics = lyrics.synced.length > 0 || lyrics.plain.length > 0;

  if (isLoading) {
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
    return (
      <div
        ref={lyricsContainerRef}
        className="h-full w-full overflow-y-auto lyrics-scroll py-[35vh] px-6 md:px-12"
        style={{ contentVisibility: 'auto', contain: 'layout paint' }}
        onWheel={() => {
           setIsUserScrolling(true);
           if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
           userScrollTimeoutRef.current = setTimeout(() => setIsUserScrolling(false), 2000);
        }}
        onTouchMove={() => {
           setIsUserScrolling(true);
           if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
           userScrollTimeoutRef.current = setTimeout(() => setIsUserScrolling(false), 2000);
        }}
      >
        {lyrics.synced.map((line, idx) => {
          const distance = idx - activeLyricIndex;
          // Optimization: Simple checks first
          const isActive = idx === activeLyricIndex;
          
          // Show ALL if scrolling, otherwise limit visible range for optimization if simpler view is needed, 
          // but the original code had this logic. Note: The logic `!isVisible` with `opacity: 0` 
          // keeps them in DOM but invisible. 
          // To strictly match original logic:
          const isVisible = isUserScrolling || (distance >= -2 && distance <= 2);
          
          // Replicate classes
          const absDistance = Math.abs(distance);
          const isNear1 = absDistance === 1;
          const isNear2 = absDistance === 2;

          return (
            <div
              key={idx}
              onClick={() =>
                audioRef.current &&
                (audioRef.current.currentTime = line.time)
              }
              className={`lyric-item my-8 md:my-10 text-3xl md:text-4xl cursor-pointer select-none transition-all duration-500 ${
                isActive ? "active-lyric scale-110" : "scale-100"
              } ${isNear1 ? "near-active near-active-1" : ""} ${
                isNear2 ? "near-active near-active-2" : ""
              } ${!isVisible ? "opacity-0 blur-sm pointer-events-none" : ""}`}
              style={{ opacity: isVisible ? undefined : 0 }} 
            >
              {line.text || "♪"}
            </div>
          );
        })}
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
