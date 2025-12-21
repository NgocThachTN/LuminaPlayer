
import React from 'react';
import { SongState } from '../types';

interface FooterPlayerProps {
  state: SongState;
  audioInfo: { format: string; bitrate: number | null };
  playlistCount: number;
  isFullScreenPlayer: boolean;
  setIsFullScreenPlayer: (v: boolean) => void;
  playPrevious: () => void;
  playNext: () => void;
  togglePlay: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  setState: React.Dispatch<React.SetStateAction<SongState>>;
  volume: number;
  setVolume: (v: number) => void;
}

export const FooterPlayer: React.FC<FooterPlayerProps> = ({
  state,
  audioInfo,
  playlistCount,
  isFullScreenPlayer,
  setIsFullScreenPlayer,
  playPrevious,
  playNext,
  togglePlay,
  audioRef,
  setState,
  volume,
  setVolume
}) => {
  return (
    <footer 
      onClick={(e) => {
         // Expand to full screen if clicking outside controls
         if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
         setIsFullScreenPlayer(true);
      }}
      className={`w-full border-t border-white/10 flex flex-col glass-header bg-black/40 backdrop-blur-xl z-[70] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer hover:bg-black/50 ${isFullScreenPlayer ? '-translate-y-[100vh] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
    >
      {/* Progress Bar - Top of footer */}
      <div className="w-full px-0 -mt-1 h-2 group relative cursor-pointer">
         <div className="absolute top-0 left-0 w-full h-1 bg-white/10 group-hover:h-1.5 transition-all duration-200">
            <div 
              className="h-full bg-white relative"
              style={{ width: `${(state.currentTime / state.duration) * 100 || 0}%` }}
            ></div>
         </div>
         <input
            type="range"
            min="0"
            max={state.duration || 0}
            value={state.currentTime}
            onChange={(e) => {
              const time = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = time;
              setState((prev) => ({ ...prev, currentTime: time }));
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-[-4px] left-0 w-full h-4 opacity-0 cursor-pointer z-20"
          />
      </div>

      <div className="flex w-full items-center justify-between px-6 py-3 h-20 gap-4">
        {/* LEFT: Song Info (Apple Music Style) */}
        <div className="flex items-center gap-4 w-[30%] min-w-0">
           {/* Tiny Album Art */}
           <div className="w-12 h-12 rounded-md shadow-lg overflow-hidden shrink-0 border border-white/10 bg-neutral-800 relative group">
             {state.metadata.cover ? (
                <img src={state.metadata.cover} alt="" className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white/20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                </div>
             )}
             {/* Expand Icon on Hover */}
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg> 
             </div>
           </div>
           
           {/* Text Info */}
           <div className="flex flex-col min-w-0 justify-center">
              <span className="font-bold text-white text-sm truncate leading-tight hover:underline cursor-pointer">
                {state.metadata.title || "Lumina Player"}
              </span>
              <span className="text-xs text-white/50 truncate font-medium hover:text-white/80 cursor-pointer">
                {state.metadata.artist || "Select a track"}
              </span>
           </div>
        </div>

        {/* CENTER: Playback Controls */}
        <div className="flex flex-col items-center justify-center w-[40%]">
           <div className="flex items-center gap-6">
               {/* Previous */}
              <button
                onClick={(e) => { e.stopPropagation(); playPrevious(); }}
                className="text-white/70 hover:text-white transition-colors p-2"
                disabled={playlistCount === 0}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
              >
                {state.isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

               {/* Next */}
              <button
                onClick={(e) => { e.stopPropagation(); playNext(); }}
                className="text-white/70 hover:text-white transition-colors p-2"
                disabled={playlistCount === 0}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
              </button>
           </div>
        </div>

        {/* RIGHT: Volume & Info */}
        <div className="flex items-center justify-end gap-4 w-[30%] text-[10px] font-medium tracking-wider uppercase text-white/40">
          {/* Format Badge (if exists) */}
          {audioInfo.format && (
              <div className="hidden lg:flex px-1.5 py-0.5 border border-white/20 rounded text-[9px] text-white/60">
                {audioInfo.format}
              </div>
          )}
          
          {/* Volume Control */}
          <div className="flex items-center gap-2 group" onClick={(e) => e.stopPropagation()}>
            <svg className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                const newVolume = Number(e.target.value);
                setVolume(newVolume);
                if (audioRef.current) audioRef.current.volume = newVolume;
              }}
              className="w-20 md:w-24 accent-white h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
