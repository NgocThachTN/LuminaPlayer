
import React, { useState, useRef, useEffect } from 'react';
import { SongState, SongMetadata } from './types';
import { getSyncedLyrics } from './services/geminiService';
import { extractMetadata } from './services/metadataService';
import { Visualizer } from './components/Visualizer';

const App: React.FC = () => {
  const [state, setState] = useState<SongState>({
    file: null,
    url: '',
    metadata: { title: 'READY TO PLAY', artist: 'SELECT A TRACK' },
    lyrics: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playlist: [],
    currentSongIndex: -1,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Add single file to playlist and play it
    const newPlaylist = [file];
    setState(prev => ({ ...prev, playlist: newPlaylist, currentSongIndex: 0 }));
    await playSong(file, 0);
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const audioFiles = Array.from(files).filter(file => file.type.startsWith('audio/'));
    if (audioFiles.length === 0) return;

    setState(prev => ({
      ...prev,
      playlist: audioFiles,
      currentSongIndex: -1
    }));
    setShowPlaylist(true);
  };

  const playSong = async (file: File, index: number) => {
    setIsLoading(true);
    const url = URL.createObjectURL(file);
    
    const metadata = await extractMetadata(file);
    const lyrics = await getSyncedLyrics(metadata.title, metadata.artist);

    setState(prev => ({
      ...prev,
      file,
      url,
      metadata,
      lyrics,
      isPlaying: true,
      currentTime: 0,
      currentSongIndex: index,
    }));
    setIsLoading(false);
  };

  const handleSongSelect = (index: number) => {
    playSong(state.playlist[index], index);
    setShowPlaylist(false); // Chuyển sang tab Lyrics sau khi chọn bài
  };

  const playNext = () => {
    if (state.currentSongIndex < state.playlist.length - 1) {
      handleSongSelect(state.currentSongIndex + 1);
    } else {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  useEffect(() => {
    if (state.isPlaying && audioRef.current) {
        audioRef.current.play().catch(e => console.error("Playback failed", e));
    }
  }, [state.url, state.isPlaying]);


  useEffect(() => {
    const index = state.lyrics.findLastIndex(l => l.time <= state.currentTime);
    if (index !== activeLyricIndex) {
      setActiveLyricIndex(index);
      if (lyricsContainerRef.current) {
        const activeElement = lyricsContainerRef.current.children[index] as HTMLElement;
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [state.currentTime, state.lyrics, activeLyricIndex]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    state.isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black text-white overflow-hidden">
      
      {/* Top Border Navigation */}
      <header className="w-full flex justify-between items-center border-b border-white/10 px-6 py-4 z-50">
        <div className="flex items-center gap-4">
          <span className="font-black text-2xl tracking-[0.2em]">LUMINA.SYS</span>
        </div>
        
        <div className="flex items-center gap-0">
          <button 
            onClick={() => setShowPlaylist(false)}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${!showPlaylist ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
          >
            Lyrics
          </button>
          <button 
            onClick={() => setShowPlaylist(true)}
            className={`square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10 ${showPlaylist ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
          >
            Playlist
          </button>
          <label className="square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10">
            Import Folder
            <input 
              type="file" 
              // @ts-ignore
              webkitdirectory="" 
              directory="" 
              className="hidden" 
              onChange={handleFolderChange} 
            />
          </label>
          <label className="square-btn px-6 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer border-l border-white/10">
            Import Track
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      </header>

      {/* Grid Content Area */}
      <main className="flex-1 w-full flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Section: Information Grid */}
        <div className="w-full md:w-[40%] flex flex-col border-r border-white/10">
          <div className="aspect-square w-full bg-neutral-900 border-b border-white/10 overflow-hidden">
            <img 
              src={state.metadata.cover} 
              className="w-full h-full object-cover"
              alt="Cover Art"
            />
          </div>
          
          <div className="p-8 flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-white/40 mb-2 uppercase tracking-[0.3em]">Currently Playing</p>
              <h2 className="text-4xl font-light mb-4 leading-tight tracking-tight">{state.metadata.title}</h2>
              <p className="text-white/40 text-sm font-medium uppercase tracking-[0.2em]">{state.metadata.artist}</p>
            </div>

            <div className="mt-8">
              <Visualizer audioElement={audioRef.current} isPlaying={state.isPlaying} />
            </div>
          </div>
        </div>

        {/* Right Section: Lyrics List or Playlist */}
        <div className="w-full md:w-[60%] relative flex flex-col bg-black">
          {showPlaylist ? (
            <div className="flex flex-col h-full">
              <div className="w-full px-8 md:px-16 py-6 border-b border-white/10 bg-black z-20 shrink-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.3em]">Playlist ({state.playlist.length})</h3>
              </div>
              <div className="flex-1 w-full overflow-y-auto lyrics-scroll p-8 md:px-16">
                <div className="flex flex-col gap-2">
                  {state.playlist.map((file, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleSongSelect(idx)}
                      className={`p-4 border border-white/10 cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-4 ${
                        idx === state.currentSongIndex ? 'bg-white/10 border-white/30' : ''
                      }`}
                    >
                      <span className="text-xs font-mono text-white/40 w-6">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-sm font-medium tracking-wider truncate flex-1">{file.name.replace(/\.[^/.]+$/, "")}</span>
                      {idx === state.currentSongIndex && (
                        <span className="text-[10px] uppercase tracking-widest text-white/60 animate-pulse">Playing</span>
                      )}
                    </div>
                  ))}
                  {state.playlist.length === 0 && (
                    <div className="text-white/20 text-sm uppercase tracking-widest text-center py-10">No tracks in playlist</div>
                  )}
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border border-white/10 border-t-white animate-spin"></div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30">Syncing Lyrics</p>
            </div>
          ) : (
            <div 
              ref={lyricsContainerRef}
              className="h-full w-full overflow-y-auto lyrics-scroll py-[30vh] px-8 md:px-16"
            >
              {state.lyrics.length > 0 ? (
                state.lyrics.map((line, idx) => (
                  <div 
                    key={idx}
                    onClick={() => audioRef.current && (audioRef.current.currentTime = line.time)}
                    className={`lyric-item text-xl md:text-2xl font-normal tracking-wide cursor-pointer ${
                      idx === activeLyricIndex ? 'active-lyric' : ''
                    }`}
                  >
                    {line.text.toUpperCase()}
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-white/10 text-xs uppercase tracking-[0.5em]">
                  {state.file ? 'No Metadata Found' : 'System Idle - Waiting for Input'}
                </div>
              )}
            </div>
          )}
          {/* Minimal Fade Overlays */}
          {!showPlaylist && (
            <>
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black to-transparent pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none"></div>
            </>
          )}
        </div>
      </main>

      {/* Control Strip */}
      <footer className="w-full border-t border-white/10 flex flex-col md:flex-row items-stretch">
        
        {/* Progress Strip */}
        <div className="w-full h-1 bg-white/5 relative group">
           <div 
             className="absolute top-0 left-0 h-full bg-white transition-all duration-100 ease-linear" 
             style={{ width: `${(state.currentTime / state.duration) * 100 || 0}%` }}
           ></div>
           <input 
              type="range" 
              min="0" 
              max={state.duration || 0} 
              value={state.currentTime} 
              onChange={(e) => {
                const time = Number(e.target.value);
                if(audioRef.current) audioRef.current.currentTime = time;
                setState(prev => ({ ...prev, currentTime: time }));
              }}
              className="absolute top-0 left-0 w-full h-full opacity-0 z-10"
            />
        </div>

        <div className="flex w-full items-center">
          <div className="p-6 border-r border-white/10 flex items-center justify-center">
            <button 
              onClick={togglePlay} 
              className="square-btn w-12 h-12 flex items-center justify-center"
            >
              {state.isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          </div>

          <div className="px-6 flex-1 flex items-center justify-between text-[10px] font-mono tracking-widest text-white/40 uppercase">
             <div>
                STATUS: {state.isPlaying ? 'PLAYING' : 'PAUSED'}
             </div>
             <div>
                {formatTime(state.currentTime)} / {formatTime(state.duration)}
             </div>
          </div>

          <div className="hidden md:flex border-l border-white/10 items-center px-8 gap-4">
             <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">VOL</span>
             <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              defaultValue="0.8"
              onChange={(e) => { if(audioRef.current) audioRef.current.volume = Number(e.target.value); }}
              className="w-20 accent-white"
             />
          </div>
        </div>
      </footer>

      <audio 
        ref={audioRef} 
        src={state.url} 
        onTimeUpdate={() => setState(prev => ({ ...prev, currentTime: audioRef.current?.currentTime || 0 }))}
        onLoadedMetadata={() => setState(prev => ({ ...prev, duration: audioRef.current?.duration || 0 }))}
        onEnded={playNext}
      />
    </div>
  );
};

export default App;
