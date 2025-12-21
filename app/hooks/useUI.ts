
import { useState, useEffect, useTransition } from "react";
import { ViewMode, SongMetadata } from "../types";
import { getDominantColor, adjustBrightness, ensureDarkColor } from "../../services/colorService";

const isElectron = !!(window as any).electronAPI;

export const useUI = (metadata: SongMetadata) => {
  const [viewMode, setViewMode] = useState<ViewMode>("playlist");
  const [deferredViewMode, setDeferredViewMode] = useState<ViewMode>("playlist");
  const [dominantColor, setDominantColor] = useState<string>("#050505");
  const [isFullScreenPlayer, setIsFullScreenPlayer] = useState(false);
  const [isRestoringLayout, setIsRestoringLayout] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [isViewReady, setIsViewReady] = useState(true);
  const [isLdacSupported, setIsLdacSupported] = useState(false);

  // Layout Refs
  // In a hook we don't necessarily manage refs unless we return them.
  // The components will handle their own refs for scrolling (e.g. LibraryView).
  
  // Sync deferred view mode with actual view mode
  useEffect(() => {
    if (viewMode !== deferredViewMode) {
      const timer = setTimeout(() => setDeferredViewMode(viewMode), 10);
      return () => clearTimeout(timer);
    }
  }, [viewMode, deferredViewMode]);

  // Extract dominant color from album cover
  useEffect(() => {
    let isMounted = true;
    if (metadata.cover) {
      getDominantColor(metadata.cover).then((color) => {
        if (isMounted) setDominantColor(color);
      });
    } else {
      setDominantColor("#050505");
    }
    return () => { isMounted = false; };
  }, [metadata.cover]);

  // Check LDAC Support
  useEffect(() => {
    let intervalId: any;
    
    const checkLdac = async () => {
      const electronAPI = (window as any).electronAPI;
      if (isElectron && electronAPI && electronAPI.checkLdacSupport) {
        const supported = await electronAPI.checkLdacSupport();
        setIsLdacSupported(prev => prev !== supported ? supported : prev);
      }
    };

    checkLdac();
    
    if (isElectron) {
      intervalId = setInterval(checkLdac, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const openPlaylist = () => {
    // startTransition not strictly needed in hook but good if passed from component
    setViewMode("playlist");
  };

  return {
    viewMode,
    setViewMode,
    deferredViewMode,
    dominantColor,
    isFullScreenPlayer,
    setIsFullScreenPlayer,
    isRestoringLayout,
    setIsRestoringLayout,
    showLyrics,
    setShowLyrics,
    showVolumePopup,
    setShowVolumePopup,
    showApiKeyModal,
    setShowApiKeyModal,
    showImportSuccess,
    setShowImportSuccess,
    selectedAlbum,
    setSelectedAlbum,
    selectedArtist,
    setSelectedArtist,
    isViewReady,
    setIsViewReady,
    isLdacSupported,
    openPlaylist,
    adjustBrightness,
    ensureDarkColor
  };
};
