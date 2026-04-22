import React, { useEffect, useState } from 'react';
import banner from '@/assets/banner.png';

export const DownloadRedirect: React.FC = () => {
  const [status, setStatus] = useState("Đang kiểm tra phiên bản...");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [versionName, setVersionName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [releaseDate, setReleaseDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        const REPO = "NgocThachTN/LuminaPlayer";
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        
        if (!response.ok) throw new Error("Không thể lấy thông tin");

        const data = await response.json();
        const assets = data.assets || [];
        
        const exeAsset = assets.find((asset: any) => asset.name.endsWith(".exe"));

        if (exeAsset) {
          setVersionName(data.tag_name);
          setDownloadUrl(exeAsset.browser_download_url);
          
          if (exeAsset.size) {
            setFileSize(`${(exeAsset.size / (1024 * 1024)).toFixed(1)} MB`);
          }
          
          if (data.published_at) {
            const date = new Date(data.published_at);
            setReleaseDate(date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }));
          }
          
          setStatus("Tìm thấy phiên bản mới!");
        } else {
          setError("Không tìm thấy file cài đặt Windows (.exe).");
        }
      } catch (err) {
        console.error(err);
        setError("Không thể kết nối đến GitHub.");
      }
    };

    fetchLatestRelease();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white font-sans">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_50%_at_50%_-10%,rgba(255,255,255,0.03),transparent)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:70px_70px]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(0,0,0,0.5),transparent)]"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center border border-white/[0.08]">
            <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">Lumina Player</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-white/30 hover:text-white/70 transition-colors">Tính năng</a>
          <a href="#download" className="text-sm text-white/30 hover:text-white/70 transition-colors">Tải về</a>
          <a href="https://github.com/NgocThachTN/LuminaPlayer" target="_blank" rel="noopener noreferrer" className="text-sm text-white/30 hover:text-white/70 transition-colors">GitHub</a>
        </nav>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-12 py-12 lg:py-20">
        
        {/* Hero */}
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
          
          {/* Left: Info */}
          <div className="flex-1 text-center lg:text-left">
            
            {/* Version Badge */}
            {versionName && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping"></span>
                </span>
                <span className="text-xs text-white/40 uppercase tracking-wider">Phiên bản mới nhất</span>
              </div>
            )}

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5">
              Lumina Player
            </h1>
            
            <p className="text-lg text-white/35 mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Trình phát nhạc địa phương cho Windows. Giao diện tối, hỗ trợ nhiều định dạng, hoàn toàn miễn phí.
            </p>

            {/* Version Info Card */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-8">
              {error ? (
                <div className="text-red-400/80 text-sm">{error}</div>
              ) : !downloadUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/10 border-t-white/40 rounded-full animate-spin"></div>
                  <span className="text-sm text-white/30">{status}</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  {/* Version */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/25 uppercase tracking-wider">Phiên bản</div>
                      <div className="text-sm font-medium text-white/80">{versionName}</div>
                    </div>
                  </div>
                  
                  {/* Size */}
                  {fileSize && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/25 uppercase tracking-wider">Dung lượng</div>
                        <div className="text-sm font-medium text-white/80">{fileSize}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Date */}
                  {releaseDate && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/25 uppercase tracking-wider">Phát hành</div>
                        <div className="text-sm font-medium text-white/80">{releaseDate}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Download Button */}
            {downloadUrl ? (
              <a 
                href={downloadUrl}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-all hover:-translate-y-0.5 text-base"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Tải về cho Windows
              </a>
            ) : error ? (
              <a href="https://github.com/NgocThachTN/LuminaPlayer/releases/latest" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-8 py-4 bg-white/[0.06] border border-white/[0.1] rounded-xl hover:bg-white/[0.1] transition-all text-base">
                Truy cập GitHub
              </a>
            ) : (
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/30 text-base">
                <div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin"></div>
                Đang tải...
              </div>
            )}

            {/* Links */}
            <div className="flex items-center gap-6 mt-6 justify-center lg:justify-start text-sm text-white/20">
              <a href="https://github.com/NgocThachTN/LuminaPlayer" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Mã nguồn
              </a>
              <span>•</span>
              <a href="https://github.com/NgocThachTN/LuminaPlayer/releases" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">
                Các phiên bản khác
              </a>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 relative w-full max-w-lg lg:max-w-none">
            <div className="relative">
              {/* Border */}
              <div className="absolute -inset-px bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-2xl"></div>
              
              {/* Image */}
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                <img 
                  src={banner} 
                  alt="Lumina Player Preview" 
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="mt-24 lg:mt-32">
          <h2 className="text-2xl font-semibold mb-10 text-center text-white/80">Tính năng</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                </svg>
              </div>
              <h3 className="font-medium mb-2 text-white/80">Hỗ trợ nhiều định dạng</h3>
              <p className="text-sm text-white/30">MP3, FLAC, WAV, AAC, ALAC, OGG và nhiều hơn nữa</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <h3 className="font-medium mb-2 text-white/80">Giao diện tối</h3>
              <p className="text-sm text-white/30">Thiết kế hiện đại, dễ nhìn trong mọi điều kiện ánh sáng</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <h3 className="font-medium mb-2 text-white/80">Nhẹ và nhanh</h3>
              <p className="text-sm text-white/30">Tiêu tốn ít tài nguyên, khởi động nhanh chóng</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
                </svg>
              </div>
              <h3 className="font-medium mb-2 text-white/80">Tùy chỉnh linh hoạt</h3>
              <p className="text-sm text-white/30">Sắp xếp thư viện, tạo playlist, chỉnh equalizer</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </div>
              <h3 className="font-medium mb-2 text-white/80">Yêu thích & Playlist</h3>
              <p className="text-sm text-white/30">Lưu bài hát yêu thích, quản lý playlist dễ dàng</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <h3 className="font-medium mb-2 text-white/80">Bảo mật & Riêng tư</h3>
              <p className="text-sm text-white/30">Không quảng cáo, không thu thập dữ liệu, mã nguồn mở</p>
            </div>
          </div>
        </section>

        {/* System Requirements */}
        <section className="mt-20 lg:mt-24">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8">
            <h2 className="text-lg font-medium mb-8 text-center text-white/60">Yêu cầu hệ thống</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] mx-auto flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
                  </svg>
                </div>
                <div className="text-sm font-medium text-white/60">Windows 10/11</div>
                <div className="text-xs text-white/20 mt-1">Hệ điều hành</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] mx-auto flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7"/>
                  </svg>
                </div>
                <div className="text-sm font-medium text-white/60">64-bit</div>
                <div className="text-xs text-white/20 mt-1">Kiến trúc</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] mx-auto flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div className="text-sm font-medium text-white/60">Miễn phí</div>
                <div className="text-xs text-white/20 mt-1">Chi phí</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] mx-auto flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <div className="text-sm font-medium text-white/60">MIT License</div>
                <div className="text-xs text-white/20 mt-1">Giấy phép</div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/[0.04]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/20">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-white/[0.04] flex items-center justify-center">
                <svg className="w-3 h-3 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <span className="text-white/40">Lumina Player</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/NgocThachTN/LuminaPlayer" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">GitHub</a>
              <a href="https://github.com/NgocThachTN/LuminaPlayer/releases" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">Releases</a>
            </div>
            <p>© 2024 NgocThachTN</p>
          </div>
        </footer>
      </main>
    </div>
  );
};