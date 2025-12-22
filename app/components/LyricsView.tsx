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
        className="h-full w-full overflow-y-auto lyrics-scroll py-[35vh] px-6 md:px-12 relative will-change-scroll"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 85%, transparent 100%)' }}
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
          const isActive = idx === activeLyricIndex;
          const isPast = idx < activeLyricIndex;

          let opacityClass = "opacity-0";
          let blurClass = "blur-0";
          let scaleClass = "scale-95";
          let pointerEvents = "pointer-events-none";

          if (isUserScrolling) {
             const absDist = Math.abs(distance);
             if (absDist <= 1) opacityClass = "opacity-100";
             else if (absDist <= 3) opacityClass = "opacity-75"; 
             else opacityClass = "opacity-40";
             
             scaleClass = "scale-100";
             pointerEvents = "pointer-events-auto";
          } else {
             const isStart = activeLyricIndex === -1;
             // Allow 4 lines if start, otherwise 3
             const maxFutureLines = isStart ? 4 : 3;

             if (isActive) {
                 opacityClass = "opacity-100";
                 scaleClass = "scale-110";
                 pointerEvents = "pointer-events-auto";
                 blurClass = "blur-0";
             } else if (distance === -1) {
                 // The line just passed - Blur it out as it fades
                 opacityClass = "opacity-0"; 
                 scaleClass = "scale-95";
                 blurClass = "blur-sm"; // Reduced from blur-lg for better performance while keeping effect
             } else if (distance > 0 && distance <= maxFutureLines) {
                 if (distance === 1) {
                    opacityClass = isStart ? "opacity-100" : "opacity-80";
                    blurClass = isStart ? "blur-0" : "blur-[0.5px]";
                    if (isStart) scaleClass = "scale-105"; // Highlight first line at start
                 } else if (distance === 2) {
                    opacityClass = isStart ? "opacity-80" : "opacity-60";
                    blurClass = isStart ? "blur-[0.5px]" : "blur-[1px]";
                 } else if (distance === 3) {
                    opacityClass = isStart ? "opacity-60" : "opacity-40";
                    blurClass = isStart ? "blur-[1px]" : "blur-[1.5px]";
                 } else { // distance 4 (only if isStart)
                    opacityClass = "opacity-40";
                    blurClass = "blur-[1.5px]";
                 }
                 
                 if (!isStart) scaleClass = "scale-100";
                 pointerEvents = "pointer-events-auto";
             }
             // Else defaults: opacity-0, blur-0 (optimization), scale-95
          }

          return (
            <div
              key={idx}
              onClick={() =>
                audioRef.current &&
                (audioRef.current.currentTime = line.time)
              }
              className={`lyric-item my-8 md:my-10 text-3xl md:text-4xl cursor-pointer select-none transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] transform-gpu ${
                isActive ? "active-lyric" : ""
              } ${opacityClass} ${blurClass} ${scaleClass} ${pointerEvents}`}
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
