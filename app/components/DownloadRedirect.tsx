import React, { useEffect, useState } from 'react';

export const DownloadRedirect: React.FC = () => {
  const [status, setStatus] = useState("Checking for latest version...");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [versionName, setVersionName] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        // Replace with your actual user/repo
        const REPO = "NgocThachTN/LuminaPlayer";
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch release info");
        }

        const data = await response.json();
        const assets = data.assets || [];
        
        // Find the .exe file
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
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505] text-white font-[Outfit]">
       {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 blur-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md text-center p-8 w-full animate-in fade-in zoom-in-95 duration-700">
         <div className="mb-4">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/50 mb-2">Lumina Player</h1>
            <p className="text-white/50 text-lg tracking-wide uppercase font-light">Your Local Music Sanctum</p>
         </div>

         <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

         <div className="flex flex-col gap-4 w-full">
            {error ? (
                <div className="flex flex-col gap-4">
                     <p className="text-red-400 font-medium">{error}</p>
                     <a 
                        href="https://github.com/NgocThachTN/LuminaPlayer/releases/latest"
                        className="w-full py-4 px-6 bg-white text-black font-bold uppercase tracking-widest rounded-lg hover:bg-white/90 hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        Go to GitHub
                    </a>
                </div>
            ) : !downloadUrl ? (
                <div className="flex flex-col items-center gap-4 py-8">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <p className="text-white/60 tracking-widest text-sm uppercase">{status}</p>
                </div>
            ) : (
                <>
                    <div className="text-center mb-2">
                        <p className="text-white/70">Ready to install</p>
                        <p className="text-2xl font-bold text-white mt-1">{versionName}</p>
                    </div>

                    <a 
                        href={downloadUrl}
                        className="w-full py-4 px-6 bg-white text-black font-bold uppercase tracking-widest rounded-lg hover:bg-white/90 hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download for Windows
                    </a>
                    
                    <a 
                        href="https://github.com/NgocThachTN/LuminaPlayer/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 px-6 bg-white/5 text-white font-medium uppercase tracking-widest rounded-lg hover:bg-white/10 transition-all border border-white/10 backdrop-blur-md flex items-center justify-center gap-3"
                    >
                        <span>GitHub Releases</span>
                         <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </>
            )}
         </div>
      </div>
    </div>
  );
};
