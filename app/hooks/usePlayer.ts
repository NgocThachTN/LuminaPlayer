
import { useState, useCallback } from "react";
import { SongState, LyricsResult, SongMetadata } from "../types";

const emptyLyrics: LyricsResult = { synced: [], plain: [], isSynced: false };

export const usePlayer = () => {
  const [state, setState] = useState<SongState>({
    file: null,
    url: "",
    metadata: { title: "READY TO PLAY", artist: "SELECT A TRACK" },
    lyrics: emptyLyrics,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playlist: [], // Legacy playlist support
    currentSongIndex: -1,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [audioInfo, setAudioInfo] = useState<{
    format: string;
    bitrate: number | null;
  }>({
    format: "",
    bitrate: null,
  });

  return {
    state,
    setState,
    isLoading,
    setIsLoading,
    volume,
    setVolume,
    audioInfo,
    setAudioInfo,
  };
};
