import React, { memo, useCallback, useMemo } from 'react';
import { SongState } from '../types';

type SyncedLyricLine = SongState['lyrics']['synced'][number];

type LyricsColors = {
  active: string;
  upcoming: string;
  faded: string;
  inactive: string;
};

type LyricVisualState = {
  className: string;
  color: string;
  textShadow: string;
};

const getLyricVisualState = (
  idx: number,
  effectiveIndex: number,
  isAtStart: boolean,
  autoScrollEnabled: boolean,
  lyricsColors: LyricsColors
): LyricVisualState => {
  const distance = idx - effectiveIndex;
  const isActive = idx === effectiveIndex;

  let opacityClass = "opacity-0";
  let scaleClass = "scale-95";
  let pointerEvents = "pointer-events-none";
  let color = lyricsColors.inactive;
  let textShadow = 'none';

  if (!autoScrollEnabled) {
    if (isActive) {
      opacityClass = "opacity-100";
      scaleClass = "scale-105";
      color = lyricsColors.active;
      textShadow = '0 0 14px rgba(255,255,255,0.24)';
    } else {
      opacityClass = "opacity-80";
      scaleClass = "scale-100";
      color = lyricsColors.upcoming;
    }
    pointerEvents = "pointer-events-auto";
  } else if (isAtStart && idx < 4) {
    if (idx === 0) {
      opacityClass = "opacity-90";
      scaleClass = "scale-105";
      color = lyricsColors.active;
      textShadow = '0 0 10px rgba(255,255,255,0.16)';
    } else if (idx === 1) {
      opacityClass = "opacity-70";
      scaleClass = "scale-100";
      color = lyricsColors.upcoming;
    } else if (idx === 2) {
      opacityClass = "opacity-40";
      scaleClass = "scale-100";
      color = lyricsColors.upcoming;
    } else {
      opacityClass = "opacity-20";
      scaleClass = "scale-100";
      color = lyricsColors.upcoming;
    }
    pointerEvents = "pointer-events-auto";
  } else if (isActive) {
    opacityClass = "opacity-90";
    scaleClass = "scale-110";
    pointerEvents = "pointer-events-auto";
    color = lyricsColors.active;
    textShadow = '0 0 14px rgba(255,255,255,0.28)';
  } else if (distance === -1) {
    opacityClass = "opacity-0";
    scaleClass = "scale-95";
  } else if (distance > 0 && distance <= 4) {
    if (distance === 1) {
      opacityClass = "opacity-60";
      color = lyricsColors.upcoming;
    } else if (distance === 2) {
      opacityClass = "opacity-30";
      color = lyricsColors.faded;
    } else if (distance === 3) {
      opacityClass = "opacity-15";
      color = lyricsColors.faded;
    } else {
      opacityClass = "opacity-5";
      color = lyricsColors.inactive;
    }
    scaleClass = "scale-100";
    pointerEvents = "pointer-events-auto";
  }

  return {
    className: `${isActive ? "active-lyric" : ""} ${opacityClass} ${scaleClass} ${pointerEvents}`,
    color,
    textShadow,
  };
};

interface SyncedLyricRowProps {
  line: SyncedLyricLine;
  className: string;
  color: string;
  textShadow: string;
  onSeek: (time: number) => void;
}

const SyncedLyricRow = memo(({
  line,
  className,
  color,
  textShadow,
  onSeek,
}: SyncedLyricRowProps) => (
  <div
    onClick={() => onSeek(line.time)}
    className={`lyric-item first:mt-0 my-5 md:my-7 text-2xl md:text-[2.5rem] leading-tight cursor-pointer select-none transform-gpu tracking-normal ${className}`}
    style={{
      color,
      textShadow,
    }}
  >
    {line.text || "♪"}
  </div>
), (prev, next) =>
  prev.line === next.line &&
  prev.className === next.className &&
  prev.color === next.color &&
  prev.textShadow === next.textShadow &&
  prev.onSeek === next.onSeek
);

SyncedLyricRow.displayName = "SyncedLyricRow";

interface LyricsViewProps {
  lyrics: SongState['lyrics'];
  isLoading: boolean;
  activeLyricIndex: number;
  autoScrollEnabled: boolean;
  stopAutoScroll: () => void;
  resumeAutoScroll: () => void;
  lyricsContainerRef: React.RefObject<HTMLDivElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
  file: File | null;
  hasStarted: boolean;
  dominantColor?: string;
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
  dominantColor = '#4a90d9'
}: LyricsViewProps) => {
  // Generate dynamic colors based on dominant color
  const lyricsColors = useMemo(() => {
    return {
      active: 'rgb(255, 255, 255)',                  // Pure bright white for active line
      upcoming: 'rgba(255, 255, 255, 0.45)',         // Dimmed white for upcoming
      faded: 'rgba(255, 255, 255, 0.3)',             // More faded for distant lines
      inactive: 'rgba(255, 255, 255, 0.2)',          // Very dim for inactive
    };
  }, [dominantColor]);

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, [audioRef]);

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
    // Use prop index directly to ensure sync with scroll hook
    const effectiveIndex = activeLyricIndex;
    const isAtStart = effectiveIndex === -1;

    // Only auto-scroll to top when at start state AND auto-scroll is enabled
    // This allows users to manually scroll even before the first lyric starts
    if (isAtStart && autoScrollEnabled && lyricsContainerRef.current && lyricsContainerRef.current.scrollTop !== 0) {
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
            const visualState = getLyricVisualState(
              idx,
              effectiveIndex,
              isAtStart,
              autoScrollEnabled,
              lyricsColors
            );

            return (
              <React.Fragment key={idx}>
              <SyncedLyricRow
                key={idx}
                line={line}
                className={visualState.className}
                color={visualState.color}
                textShadow={visualState.textShadow}
                onSeek={handleSeek}
              />
              {/*
                {line.text || "♪"}
              */}
              </React.Fragment>
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
