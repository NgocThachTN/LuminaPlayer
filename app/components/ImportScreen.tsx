
import React from 'react';

interface ImportScreenProps {
  isElectron: boolean;
  onFolderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onElectronFolderSelect: () => void;
  onElectronFileSelect: () => void;
}

export const ImportScreen: React.FC<ImportScreenProps> = ({
  isElectron,
  onFolderChange,
  onFileChange,
  onElectronFolderSelect,
  onElectronFileSelect
}) => {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 blur-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>
      
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md text-center p-8">
         <div className="mb-4">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/50 mb-2">Lumina Player</h1>
            <p className="text-white/50 text-lg tracking-wide uppercase font-light">Your Local Music Sanctum</p>
         </div>

         <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

         <div className="flex flex-col gap-4 w-full">
            <p className="text-white/70 mb-2">Import your music to begin</p>
            
            {isElectron ? (
               <>
               <button 
                 onClick={onElectronFolderSelect}
                 className="w-full py-4 px-6 bg-white text-black font-bold uppercase tracking-widest rounded-lg hover:bg-white/90 hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
               >
                 Open Music Folder
               </button>
               <button 
                 onClick={onElectronFileSelect}
                 className="w-full py-4 px-6 bg-white/10 text-white font-medium uppercase tracking-widest rounded-lg hover:bg-white/20 transition-all border border-white/10 backdrop-blur-md"
               >
                 Open File
               </button>
               </>
            ) : (
               <>
               <label className="w-full py-4 px-6 bg-white text-black font-bold uppercase tracking-widest rounded-lg hover:bg-white/90 hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] cursor-pointer flex items-center justify-center">
                 <span>Open Music Folder</span>
                 <input type="file" // @ts-ignore
                  webkitdirectory="" directory="" className="hidden" onChange={onFolderChange} />
               </label>
               <label className="w-full py-4 px-6 bg-white/10 text-white font-medium uppercase tracking-widest rounded-lg hover:bg-white/20 transition-all border border-white/10 backdrop-blur-md cursor-pointer flex items-center justify-center">
                 <span>Open File</span>
                 <input type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
               </label>
               </>
            )}
         </div>
      </div>
    </div>
  );
};
