import React, { useEffect, useState } from 'react';
import banner from '@/assets/banner.png';

export const DownloadRedirect: React.FC = () => {
  const [status, setStatus] = useState("Checking for latest version...");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [versionName, setVersionName] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        const REPO = "NgocThachTN/LuminaPlayer";
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch release info");
        }

        const data = await response.json();
        const assets = data.assets || [];
        
        const exeAsset = assets.find((asset: any) => asset.name.endsWith(".exe"));

        if (exeAsset) {
          setVersionName(data.name || data.tag_name);
          setDownloadUrl(exeAsset.browser_download_url);
          setStatus("Latest version found!");
        } else {
          setError("No Windows installer (.exe) found in the latest release.");
        }
      } catch (err) {
        console.error(err);
        setError("Could not connect to GitHub releases.");
      }
    };

    fetchLatestRelease();
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#050505] text-white font-[Outfit] overflow-hidden p-4 md:p-8 lg:p-16">
       {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-30 blur-3xl scale-110 animate-breathe"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-[#050505]/40"></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
         
         {/* ITEM 1: Title Section (Mobile: Top, Desktop: Right Top) */}
         <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-4 animate-in slide-in-from-right-8 fade-in duration-1000 delay-200 lg:col-start-2 lg:row-start-1">
                <style>
                    {`
                    @keyframes gradient-x {
                        0%, 100% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                    }
                    @keyframes float {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-15px); }
                    }
                    @keyframes equalizer {
                        0%, 100% { height: 4px; }
                        50% { height: 12px; }
                    }
                    @keyframes breathe {
                        0%, 100% { opacity: 0.4; transform: scale(1.1); }
                        50% { opacity: 0.25; transform: scale(1); }
                    }
                    @keyframes shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    .animate-gradient-text {
                        background-size: 200% auto;
                        animation: gradient-x 15s linear infinite;
                    }
                    .animate-float {
                        animation: float 10s ease-in-out infinite;
                    }
                    .animate-breathe {
                        animation: breathe 10s ease-in-out infinite;
                    }
                    .equalizer-bar {
                        width: 3px;
                        background: #4ade80; /* green-400 */
                        border-radius: 1px;
                        animation: equalizer 1s ease-in-out infinite;
                    }
                    .group:hover .shimmer-effect {
                        animation: shimmer 1.5s infinite;
                    }
                    `}
                </style>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none whitespace-nowrap">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/50 animate-gradient-text">
                        Lumina Player
                    </span>
                </h1>
                <p className="text-white/60 text-lg lg:text-xl tracking-[0.2em] uppercase font-light pl-1 animate-in slide-in-from-bottom-2 fade-in duration-700 delay-300">
                    Your Local Music Sanctum
                </p>
                <div className="h-1 w-20 bg-gradient-to-r from-white/10 to-white/30 rounded-full mx-auto lg:mx-0 mt-6 lg:mt-8 animate-in width-in duration-1000 delay-500"></div>
         </div>

         {/* ITEM 2: Hero Image (Mobile: Middle, Desktop: Left Spanning) */}
         <div className="relative w-full group perspective-1000 animate-in slide-in-from-left-8 fade-in duration-1000 flex items-center justify-center lg:justify-end animate-float lg:col-start-1 lg:row-start-1 lg:row-span-2">
            {/* Glow behind image */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 rounded-[2rem]"></div>
            
            <img 
              src={banner} 
              alt="Lumina Player Preview" 
              className="relative w-full max-w-xl lg:max-w-full rounded-xl shadow-2xl border border-white/10 transform transition-transform duration-500 hover:scale-[1.01] object-contain"
            />
            
            {/* Reflective shine */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
         </div>

         {/* ITEM 3: Action Card (Mobile: Bottom, Desktop: Right Bottom) */}
         <div className="w-full max-w-md mx-auto lg:mx-0 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-500 lg:col-start-2 lg:row-start-2">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:bg-white/10 transition-colors duration-300">
                    
                    {!error && !downloadUrl ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            <p className="text-white/40 text-sm uppercase tracking-widest">{status}</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col gap-4">
                            <p className="text-red-400 font-medium">{error}</p>
                            <a href="https://github.com/NgocThachTN/LuminaPlayer/releases/latest" className="btn-secondary">Go to GitHub</a>
                        </div>
                    ) : (
                        <>
                            {/* Version Info */}
                            <div className="flex flex-row items-center justify-between border-b border-white/5 pb-4 mb-2">
                                <div className="flex flex-col items-start">
                                    <span className="text-sm text-white/40 uppercase tracking-wider">Latest Version</span>
                                    <span className="text-2xl font-bold text-white">{versionName}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                                    <div className="flex gap-[2px] items-end h-3">
                                        <div className="equalizer-bar" style={{ animationDelay: '0s' }}></div>
                                        <div className="equalizer-bar" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="equalizer-bar" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                    <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Stable</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-col gap-3">
                                <a 
                                    href={downloadUrl!}
                                    className="group relative w-full py-4 px-6 bg-white text-black font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 overflow-hidden"
                                >
                                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent shimmer-effect"></div>
                                    <svg className="w-5 h-5 transition-transform group-hover:translate-y-0.5 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Download for Windows</span>
                                </a>
                                
                                <a 
                                    href="https://github.com/NgocThachTN/LuminaPlayer/releases"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3.5 px-6 bg-transparent text-white/70 font-medium uppercase tracking-widest rounded-xl hover:bg-white/5 hover:text-white transition-all border border-white/10 flex items-center justify-center gap-2 group"
                                >
                                    <span>GitHub Releases</span>
                                    <svg className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                            <div className="flex flex-col gap-1 items-center justify-center pt-4 opacity-30 text-xs uppercase tracking-widest hover:opacity-100 transition-opacity">
                                <p>Requires Windows 10 or Windows 11</p>
                                <p>Open Source • MIT License</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
      </div>
    </div>
  );
};
