
import { useState, useRef, useEffect, useCallback } from "react";
import { SongState } from "../types";

export const useLyrics = (state: SongState, audioRef: React.RefObject<HTMLAudioElement>) => {
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  
  // Track if we should initially scroll (prevents scroll before lyrics are visible)
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of active index in ref for async access (timeout)
  const activeLyricIndexRef = useRef(activeLyricIndex);
  useEffect(() => { activeLyricIndexRef.current = activeLyricIndex; }, [activeLyricIndex]);

  // Track song identity to reset on song change
  const lastSongUrlRef = useRef(state.url);
  const lastLyricsRef = useRef(state.lyrics);

  // Easing function for smooth premium feel (Ease Out Cubic)
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Helper function to perform the actual scroll
  const performScroll = useCallback((index: number, behavior: ScrollBehavior | "smooth-custom" = "smooth-custom") => {
     if (lyricsContainerRef.current && index >= 0) {
        const activeElement = lyricsContainerRef.current.children[index] as HTMLElement;
        if (activeElement) {
           const container = lyricsContainerRef.current;
           
           const elementTop = activeElement.offsetTop;
           
           // Get the ACTUAL computed padding-top from the container
           // This ensures we use the exact same value that CSS is using
           const computedStyle = window.getComputedStyle(container);
           const paddingTop = parseFloat(computedStyle.paddingTop) || (window.innerHeight * 0.35);
           
           // Target scroll position: Put element at the same position as padding-top
           const targetScroll = Math.max(0, elementTop - paddingTop);
           
           // Get current scroll position
           const currentScroll = container.scrollTop;
           
           // If difference is very small (< 3px), skip scroll to prevent jitter
           if (Math.abs(targetScroll - currentScroll) < 3) {
              return;
           }
           
           // Instant or Native Smooth
           if (behavior === "instant" || behavior === "auto") {
               container.scrollTo({ top: targetScroll, behavior: "auto" });
               return;
           }

           // Custom Smooth Scroll Optimization
           const startY = currentScroll;
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

  // Lock auto-scroll when user interacts, and auto-resume after 4s idle
  const stopAutoScroll = useCallback(() => {
     setAutoScrollEnabled(false);
     
     if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
     
     resumeTimeoutRef.current = setTimeout(() => {
         resumeAutoScroll();
     }, 4000);
  }, [resumeAutoScroll]);

  // CORE: Lyric tracking - updates activeLyricIndex based on currentTime
  useEffect(() => {
    if (!state.lyrics.isSynced || state.lyrics.synced.length === 0) return;

    // Add small offset (200ms ahead) so lyrics feel more in sync
    const currentTime = state.currentTime + 0.2;
    const index = state.lyrics.synced.findLastIndex(
      (l) => l.time <= currentTime
    );

    // Only update if changed and valid
    if (index !== activeLyricIndex) {
      setActiveLyricIndex(index);
    }
  }, [state.currentTime, state.lyrics, activeLyricIndex]);

  // CORE: Auto-scroll when activeLyricIndex changes
  useEffect(() => {
    // Don't scroll if:
    // - No active lyric (index < 0)
    // - Auto-scroll disabled by user
    // - Initial scroll not yet done (lyrics panel may not be visible)
    if (activeLyricIndex < 0 || !autoScrollEnabled) return;
    
    // If this is the first scroll after song/lyrics change, do it instantly
    const behavior = !initialScrollDone ? "instant" : "smooth-custom";
    
    if (!initialScrollDone) {
      setInitialScrollDone(true);
    }

    // Debounce scroll to avoid excessive calls
    const now = Date.now();
    if (now - lastScrollTimeRef.current > 80) {
      lastScrollTimeRef.current = now;

      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }

      // Double RAF to ensure we run AFTER the layout/paint of the new class state
      scrollTimeoutRef.current = requestAnimationFrame(() => {
         requestAnimationFrame(() => {
             performScroll(activeLyricIndex, behavior);
         });
      });
    }
  }, [activeLyricIndex, autoScrollEnabled, initialScrollDone, performScroll]);

  // Reset states when song URL changes
  useEffect(() => {
    if (lastSongUrlRef.current !== state.url) {
      lastSongUrlRef.current = state.url;
      
      // Reset scroll position
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
      }
      
      // Reset all state
      setActiveLyricIndex(-1);
      setAutoScrollEnabled(true);
      setInitialScrollDone(false);
      lastScrollTimeRef.current = 0;
    }
  }, [state.url]);

  // Reset activeLyricIndex when lyrics change (e.g., async load)
  useEffect(() => {
    if (lastLyricsRef.current !== state.lyrics) {
      lastLyricsRef.current = state.lyrics;
      
      // Reset scroll position when new lyrics load
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = 0;
      }
      
      setActiveLyricIndex(-1);
      setInitialScrollDone(false);
    }
  }, [state.lyrics]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  // hasStarted is now simply: isPlaying && currentTime > 0
  const hasStarted = state.isPlaying && state.currentTime > 0;

  return {
    activeLyricIndex,
    autoScrollEnabled,
    stopAutoScroll,
    resumeAutoScroll,
    lyricsContainerRef,
    scrollToActiveLine,
    hasStarted,
  };
};
