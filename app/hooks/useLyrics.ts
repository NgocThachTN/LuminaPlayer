
import { useState, useRef, useEffect, useCallback } from "react";
import { SongState } from "../types";

export const useLyrics = (state: SongState, audioRef: React.RefObject<HTMLAudioElement>) => {
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of active index in ref for async access (timeout)
  const activeLyricIndexRef = useRef(activeLyricIndex);
  useEffect(() => { activeLyricIndexRef.current = activeLyricIndex; }, [activeLyricIndex]);

  // Safeguard against stale time values during song transition
  const lastSongUrlRef = useRef(state.url);
  const ignoreTimeRef = useRef(false);

  // If song URL changes, ignore time updates until time resets
  if (lastSongUrlRef.current !== state.url) {
      lastSongUrlRef.current = state.url;
      ignoreTimeRef.current = true;
  }

  // If time resets to near 0, stop ignoring
  if (ignoreTimeRef.current && state.currentTime < 1) {
      ignoreTimeRef.current = false;
  }

  // Easing function for smooth premium feel (Ease Out Cubic)
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Helper function to perform the actual scroll
  const performScroll = useCallback((index: number, behavior: ScrollBehavior | "smooth-custom" = "smooth-custom") => {
     if (lyricsContainerRef.current) {
        const activeElement = lyricsContainerRef.current.children[index] as HTMLElement;
        if (activeElement) {
           const container = lyricsContainerRef.current;
           let containerHeight = container.clientHeight;
           
           if (containerHeight < 200) containerHeight = window.innerHeight * 0.6;
           
           const elementTop = activeElement.offsetTop;
           const elementHeight = activeElement.clientHeight;
           
           // Target position
           const targetScroll = elementTop - containerHeight * 0.3 + elementHeight / 2;
           
           // Instant or Native Smooth (not used by default anymore)
           if (behavior === "instant" || behavior === "auto") {
               container.scrollTo({ top: targetScroll, behavior: "auto" });
               return;
           }

           // Custom Smooth Scroll Optimization
           const startY = container.scrollTop;
           const change = targetScroll - startY;
           const startTime = performance.now();
           const duration = 700; // Slower, smoother duration

           const animateScroll = (currentTime: number) => {
               const elapsed = currentTime - startTime;
               if (elapsed > duration) {
                   container.scrollTop = targetScroll;
                   return;
               }
               
               const progress = easeOutCubic(elapsed / duration);
               container.scrollTop = startY + change * progress;
               
               requestAnimationFrame(animateScroll);
           };
           
           requestAnimationFrame(animateScroll);
        }
     }
  }, []);

  // Exposed function to force scroll to active line
  // Uses Ref to ensure we always scroll to the *current* active line even if called from a stale timeout
  const scrollToActiveLine = useCallback((instant = false) => {
     const idx = activeLyricIndexRef.current;
     if (idx >= 0) {
        if (scrollTimeoutRef.current) {
            cancelAnimationFrame(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = requestAnimationFrame(() => {
            performScroll(idx, instant ? "instant" : "smooth");
        });
     }
  }, [performScroll]);

  // Resume auto-scroll and snap to current line
  const resumeAutoScroll = useCallback(() => {
     if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
     setAutoScrollEnabled(true);
     scrollToActiveLine(false);
  }, [scrollToActiveLine]);

  // Lock auto-scroll when user interacts, and auto-resume after 5s idle
  const stopAutoScroll = useCallback(() => {
     setAutoScrollEnabled(false);
     
     if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
     
     resumeTimeoutRef.current = setTimeout(() => {
         resumeAutoScroll();
     }, 4000); // 4000-5000ms delay
  }, [resumeAutoScroll]);

  // Optimized lyric tracking with debounced scroll (only for synced lyrics)
  useEffect(() => {
    if (ignoreTimeRef.current || !state.lyrics.isSynced || state.lyrics.synced.length === 0) return;

    // Add small offset (200ms ahead) so lyrics feel more in sync
    const currentTime = state.currentTime + 0.2;
    const index = state.lyrics.synced.findLastIndex(
      (l) => l.time <= currentTime
    );

    if (index !== activeLyricIndex && index >= 0) {
      setActiveLyricIndex(index);

      // Debounce scroll to avoid excessive calls
      const now = Date.now();
      if (now - lastScrollTimeRef.current > 100) {
        lastScrollTimeRef.current = now;

        if (scrollTimeoutRef.current) {
          cancelAnimationFrame(scrollTimeoutRef.current);
        }

        // Double RAF to ensure we run AFTER the layout/paint of the new class state
        scrollTimeoutRef.current = requestAnimationFrame(() => {
           requestAnimationFrame(() => {
               // If this is the first activation (-1 -> index), snap instantly to avoid lag/jump
               // Otherwise animate smoothly
               const behavior = activeLyricIndex === -1 ? "instant" : "smooth-custom";
               
               // Only auto-scroll if enabled OR if it's the very first load
               if (autoScrollEnabled || activeLyricIndex === -1) {
                   performScroll(index, behavior);
               }
           });
        });
      }
    }
  }, [state.currentTime, state.lyrics, activeLyricIndex, performScroll, autoScrollEnabled]);

  // Scroll lyrics to top when song changes (track by URL for uniqueness)
  useEffect(() => {
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTop = 0;
    }
    setActiveLyricIndex(-1);
    setAutoScrollEnabled(true); // Reset scroll lock on new song
    lastScrollTimeRef.current = 0;
    
    // Reset our stale time usage reference
    lastSongUrlRef.current = state.url;
    ignoreTimeRef.current = true; // Actively ignore time at start of new URL
  }, [state.url]);

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
    autoScrollEnabled,
    stopAutoScroll,
    resumeAutoScroll,
    lyricsContainerRef,
    scrollToActiveLine,
  };
};
