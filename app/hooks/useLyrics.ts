
import { useState, useRef, useEffect, useCallback } from "react";
import { SongState } from "../types";

const findActiveLyricIndex = (
  lines: SongState["lyrics"]["synced"],
  currentTime: number
) => {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;

    if (lines[mid].time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
};

const resolveActiveLyricIndex = (
  lines: SongState["lyrics"]["synced"],
  currentTime: number,
  currentIndex: number
) => {
  if (currentIndex === -1 && (!lines[0] || currentTime < lines[0].time)) {
    return -1;
  }

  if (currentIndex >= 0 && currentIndex < lines.length) {
    const currentLineTime = lines[currentIndex].time;
    const nextLineTime = lines[currentIndex + 1]?.time ?? Infinity;

    if (currentTime >= currentLineTime && currentTime < nextLineTime) {
      return currentIndex;
    }
  }

  return findActiveLyricIndex(lines, currentTime);
};

export const useLyrics = (state: SongState, audioRef: React.RefObject<HTMLAudioElement>) => {
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  
  // Track if we should initially scroll (prevents scroll before lyrics are visible)
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef(0);
  const lyricsPaddingTopRef = useRef<number | null>(null);
  const lyricOffsetTopCacheRef = useRef<number[]>([]);
  const scrollTimeoutRef = useRef<number | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of active index in ref for async access (timeout)
  const activeLyricIndexRef = useRef(activeLyricIndex);
  useEffect(() => { activeLyricIndexRef.current = activeLyricIndex; }, [activeLyricIndex]);

  // Track song identity to reset on song change
  const lastSongUrlRef = useRef(state.url);
  const lastLyricsRef = useRef(state.lyrics);
  
  // Track previous time to detect seeking backward
  const lastTimeRef = useRef(state.currentTime);
  
  // Track if we're in the process of seeking (to handle fast seeks)
  const isSeekingRef = useRef(false);

  // Smooth Apple Music-like scroll: gentle start, soft settle.
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const getScrollTargetIndex = useCallback(() => {
    if (!state.lyrics.isSynced || state.lyrics.synced.length === 0) {
      return -1;
    }

    return activeLyricIndexRef.current >= 0 ? activeLyricIndexRef.current : 0;
  }, [state.lyrics]);

  const resetCachedLyricsLayout = useCallback(() => {
    lyricsPaddingTopRef.current = null;
    lyricOffsetTopCacheRef.current = [];
  }, []);

  const cancelPendingScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      cancelAnimationFrame(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  }, []);

  // Helper function to perform the actual scroll
  const performScroll = useCallback((index: number, behavior: ScrollBehavior | "smooth-custom" = "smooth-custom") => {
     if (lyricsContainerRef.current && index >= 0) {
        const activeElement = lyricsContainerRef.current.children[index] as HTMLElement;
        if (activeElement) {
           const container = lyricsContainerRef.current;
           if (container.clientWidth === 0 || container.clientHeight === 0) {
             resetCachedLyricsLayout();
             return;
           }

           cancelPendingScroll();
           
           let elementTop = lyricOffsetTopCacheRef.current[index];
           if (elementTop === undefined) {
              elementTop = activeElement.offsetTop;
              lyricOffsetTopCacheRef.current[index] = elementTop;
           }
           
           let paddingTop = lyricsPaddingTopRef.current;
           if (paddingTop === null) {
              const computedStyle = window.getComputedStyle(container);
              paddingTop = parseFloat(computedStyle.paddingTop) || (window.innerHeight * 0.26);
              lyricsPaddingTopRef.current = paddingTop;
           }
           
           // Target scroll position: Put element at the same position as padding-top
           const targetScroll = Math.max(0, elementTop - paddingTop);
           
           // Get current scroll position
           const currentScroll = container.scrollTop;
           
           // For instant scroll (e.g., on seek or initial load), always perform it
           // This ensures proper positioning even if difference is small
           if (behavior === "instant" || behavior === "auto") {
               container.scrollTo({ top: targetScroll, behavior: "auto" });
               return;
           }
           
           // For smooth scroll, skip if difference is very small (< 3px) to prevent jitter
           if (Math.abs(targetScroll - currentScroll) < 3) {
              return;
           }

           // Custom Smooth Scroll Optimization
           const startY = currentScroll;
           const change = targetScroll - startY;
           const startTime = performance.now();
           const duration = Math.min(1100, Math.max(680, Math.abs(change) * 0.82));

           const animateScroll = (currentTime: number) => {
               const elapsed = currentTime - startTime;
               if (elapsed > duration) {
                   container.scrollTop = targetScroll;
                   scrollAnimationRef.current = null;
                   return;
               }
               
               const progress = easeInOutCubic(elapsed / duration);
               container.scrollTop = startY + change * progress;
               
               scrollAnimationRef.current = requestAnimationFrame(animateScroll);
           };
           
           scrollAnimationRef.current = requestAnimationFrame(animateScroll);
        }
     }
  }, [cancelPendingScroll, resetCachedLyricsLayout]);

  useEffect(() => {
    window.addEventListener("resize", resetCachedLyricsLayout);
    return () => window.removeEventListener("resize", resetCachedLyricsLayout);
  }, [resetCachedLyricsLayout]);

  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let resizeFrame: number | null = null;

    const syncActiveLineToLayout = () => {
      if (!autoScrollEnabled) return;

      const idx = getScrollTargetIndex();
      if (idx < 0) return;

      cancelPendingScroll();
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        performScroll(idx, "instant");
      });
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (entry.contentRect.width <= 0 || entry.contentRect.height <= 0) {
        resetCachedLyricsLayout();
        return;
      }

      resetCachedLyricsLayout();
      syncActiveLineToLayout();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }
    };
  }, [autoScrollEnabled, cancelPendingScroll, getScrollTargetIndex, performScroll, resetCachedLyricsLayout]);

  // Exposed function to force scroll to active line
  const scrollToActiveLine = useCallback((instant = false) => {
     const idx = getScrollTargetIndex();
     if (idx >= 0) {
        cancelPendingScroll();
        scrollTimeoutRef.current = requestAnimationFrame(() => {
            scrollTimeoutRef.current = null;
            performScroll(idx, instant ? "instant" : "smooth");
        });
     }
  }, [cancelPendingScroll, getScrollTargetIndex, performScroll]);

  const resetLyricsLayout = useCallback(() => {
    resetCachedLyricsLayout();
    scrollToActiveLine(true);
  }, [resetCachedLyricsLayout, scrollToActiveLine]);

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

  // Listen to audio seeking events directly for reliable seek detection
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleSeeking = () => {
      isSeekingRef.current = true;
    };
    
    const handleSeeked = () => {
      isSeekingRef.current = false;
      const currentTime = audio.currentTime;
      
      // If seeked to near start, reset lyrics state
      if (currentTime < 1.5) {
        if (lyricsContainerRef.current) {
          lyricsContainerRef.current.scrollTop = 0;
        }
        setActiveLyricIndex(-1);
        setInitialScrollDone(false);
        setAutoScrollEnabled(true); // Re-enable auto scroll
        lastTimeRef.current = currentTime;
      }
    };
    
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);
    
    return () => {
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
    };
  }, [audioRef]);

  // CORE: Lyric tracking - updates activeLyricIndex based on currentTime
  useEffect(() => {
    if (!state.lyrics.isSynced || state.lyrics.synced.length === 0) return;

    const currTime = state.currentTime;
    lastTimeRef.current = currTime;
    
    // Force "start" state when at the very beginning (< 2s)
    // This ensures lyrics always display correctly after seeking to start
    // Use 2s threshold because time display shows rounded values
    // Force "start" state when at the very beginning
    // Only reset if we are essentially at 0. This allows lyrics at 0:01 to show.
    if (currTime < 0.2) {
      if (activeLyricIndexRef.current !== -1) {
        setActiveLyricIndex(-1);
        setInitialScrollDone(false);
        setAutoScrollEnabled(true);
        // Reset scroll position to top
        if (lyricsContainerRef.current) {
          lyricsContainerRef.current.scrollTop = 0;
        }
      }
      return;
    }

    // Add small offset (200ms ahead) so lyrics feel more in sync
    const currentTime = currTime + 0.2;
    const index = resolveActiveLyricIndex(
      state.lyrics.synced,
      currentTime,
      activeLyricIndexRef.current
    );

    // Only update if changed
    if (index !== activeLyricIndexRef.current) {
      setActiveLyricIndex(index);
    }
  }, [state.currentTime, state.lyrics]);

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

      cancelPendingScroll();

      // Double RAF to ensure we run AFTER the layout/paint of the new class state
      scrollTimeoutRef.current = requestAnimationFrame(() => {
         scrollTimeoutRef.current = requestAnimationFrame(() => {
             scrollTimeoutRef.current = null;
             performScroll(activeLyricIndex, behavior);
         });
      });
    }
  }, [activeLyricIndex, autoScrollEnabled, initialScrollDone, cancelPendingScroll, performScroll]);

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
      lyricsPaddingTopRef.current = null;
      lyricOffsetTopCacheRef.current = [];
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
      lyricsPaddingTopRef.current = null;
      lyricOffsetTopCacheRef.current = [];
    }
  }, [state.lyrics]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
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
    resetLyricsLayout,
    hasStarted,
  };
};
