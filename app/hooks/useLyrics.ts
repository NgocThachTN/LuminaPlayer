
import { useState, useRef, useEffect } from "react";
import { SongState } from "../types";

export const useLyrics = (state: SongState, audioRef: React.RefObject<HTMLAudioElement>) => {
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Optimized lyric tracking with debounced scroll (only for synced lyrics)
  useEffect(() => {
    if (!state.lyrics.isSynced || state.lyrics.synced.length === 0) return;

    // Add small offset (200ms ahead) so lyrics feel more in sync
    const currentTime = state.currentTime + 0.2;
    const index = state.lyrics.synced.findLastIndex(
      (l) => l.time <= currentTime
    );

    if (index !== activeLyricIndex && index >= 0) {
      setActiveLyricIndex(index);

      // Don't auto-scroll if user is scrolling
      // if (isUserScrolling) return; 
      // Actually per App.tsx logic, we still scroll unless user interaction flag prevents it?
      // In App.tsx the `isUserScrolling` only affects visibility of lines (fading out others).
      // The scroll logic itself just checks `lastScrollTimeRef`.
      
      // Debounce scroll to avoid excessive calls
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 100) {
        lastScrollTimeRef.current = now;

        if (scrollTimeoutRef.current) {
          cancelAnimationFrame(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = requestAnimationFrame(() => {
          if (lyricsContainerRef.current) {
            const activeElement = lyricsContainerRef.current.children[
              index
            ] as HTMLElement;
            if (activeElement) {
              const container = lyricsContainerRef.current;
              const containerHeight = container.clientHeight;
              const elementTop = activeElement.offsetTop;
              const elementHeight = activeElement.clientHeight;
              const targetScroll =
                elementTop - containerHeight / 2 + elementHeight / 2;

              container.scrollTo({
                top: targetScroll,
                behavior: "smooth",
              });
            }
          }
        });
      }
    }
  }, [state.currentTime, state.lyrics, activeLyricIndex]);

  // Scroll lyrics to top when song changes
  useEffect(() => {
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
    }
    setActiveLyricIndex(-1);
    lastScrollTimeRef.current = 0;
  }, [state.currentSongIndex]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    activeLyricIndex,
    isUserScrolling,
    setIsUserScrolling,
    userScrollTimeoutRef,
    lyricsContainerRef,
  };
};
