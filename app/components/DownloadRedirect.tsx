import React, { useEffect, useState } from 'react';
import banner from '@/assets/banner.png';
import appLogo from '@/resources/icons/lumina-icon.png';

type ReleaseState = {
  downloadUrl: string | null;
  versionName: string | null;
  fileSize: string | null;
  releaseDate: string | null;
};

const REPO = 'NgocThachTN/LuminaPlayer';

export const DownloadRedirect: React.FC = () => {
  const [status, setStatus] = useState('Đang kiểm tra phiên bản mới nhất...');
  const [error, setError] = useState<string | null>(null);
  const [release, setRelease] = useState<ReleaseState>({
    downloadUrl: null,
    versionName: null,
    fileSize: null,
    releaseDate: null,
  });

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyHeight = document.body.style.height;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlHeight = document.documentElement.style.height;

    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.height = previousBodyHeight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.height = previousHtmlHeight;
    };
  }, []);

  useEffect(() => {
    const fetchLatestRelease = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);

        if (!response.ok) {
          throw new Error('Không thể lấy thông tin bản phát hành.');
        }

        const data = await response.json();
        const assets = data.assets || [];
        const exeAsset = assets.find((asset: any) => String(asset.name || '').endsWith('.exe'));

        if (!exeAsset) {
          setError('Không tìm thấy file cài đặt Windows (.exe).');
          return;
        }

        setRelease({
          downloadUrl: exeAsset.browser_download_url,
          versionName: data.tag_name || data.name || 'Latest',
          fileSize: exeAsset.size ? `${(exeAsset.size / (1024 * 1024)).toFixed(1)} MB` : null,
          releaseDate: data.published_at
            ? new Date(data.published_at).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : null,
        });
        setStatus('Sẵn sàng tải về');
      } catch (err) {
        console.error(err);
        setError('Không thể kết nối đến GitHub. Vui lòng mở trang Releases để tải thủ công.');
      }
    };

    fetchLatestRelease();
  }, []);

  const details = [
    { label: 'Nền tảng', value: 'Windows 10/11' },
    { label: 'Kiến trúc', value: '64-bit' },
    { label: 'Giấy phép', value: 'MIT' },
  ];

  const releaseDetails = [
    { label: 'Phiên bản', value: release.versionName },
    { label: 'Dung lượng', value: release.fileSize },
    { label: 'Phát hành', value: release.releaseDate },
  ].filter((item) => item.value);

  const features = [
    {
      title: 'Thư viện nhạc local',
      description: 'Import file hoặc folder nhạc trên máy và phát trực tiếp trong app.',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      ),
    },
    {
      title: 'Lyrics đồng bộ',
      description: 'Tự tìm lời bài hát và hiển thị theo thời gian phát nhạc.',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l10-2v12M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm10-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
      ),
    },
    {
      title: 'Discord Rich Presence',
      description: 'Hiển thị bài đang nghe và trạng thái phát nhạc trên Discord.',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M7 8h10a4 4 0 014 4v4a3 3 0 01-3 3h-1l-2-2H9l-2 2H6a3 3 0 01-3-3v-4a4 4 0 014-4z" />
      ),
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05090d] text-white font-sans">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,165,233,0.18)_0%,rgba(5,9,13,0)_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#05090d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a href="/" className="flex items-center gap-3">
            <img src={appLogo} alt="LuminaPlayer" className="h-11 w-11 rounded-xl" />
            <div>
              <div className="text-base font-bold tracking-tight">LuminaPlayer</div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-300/70">Local Music Player</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <a href="#features" className="transition hover:text-white">Tính năng</a>
            <a href="#requirements" className="transition hover:text-white">Yêu cầu</a>
            <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100">
              <img src={appLogo} alt="" className="h-6 w-6 rounded-md" />
              App nghe nhạc local cho Windows
            </div>

            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Tải LuminaPlayer cho thư viện nhạc trên máy của bạn.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/65 md:text-lg">
              Một trình phát nhạc desktop gọn, đẹp, tập trung vào nhạc local, lyrics đồng bộ,
              metadata thông minh và trải nghiệm nghe nhạc không quảng cáo.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {release.downloadUrl ? (
                <a
                  id="download"
                  href={release.downloadUrl}
                  className="inline-flex items-center justify-center gap-3 rounded-xl bg-sky-300 px-6 py-4 text-base font-bold text-slate-950 shadow-[0_20px_60px_rgba(14,165,233,0.28)] transition hover:-translate-y-0.5 hover:bg-sky-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                  </svg>
                  Tải về cho Windows
                </a>
              ) : error ? (
                <a
                  id="download"
                  href={`https://github.com/${REPO}/releases/latest`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/8 px-6 py-4 text-base font-bold text-white transition hover:bg-white/12"
                >
                  Mở GitHub Releases
                </a>
              ) : (
                <div
                  id="download"
                  className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/8 px-6 py-4 text-base font-bold text-white/70"
                >
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-sky-200" />
                  {status}
                </div>
              )}

              <a
                href={`https://github.com/${REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-white/12 px-6 py-4 text-base font-semibold text-white/80 transition hover:bg-white/8 hover:text-white"
              >
                Xem mã nguồn
              </a>
            </div>

            {error && <p className="mt-4 text-sm text-red-300/85">{error}</p>}

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {releaseDetails.length > 0
                ? releaseDetails.map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-white/35">{item.label}</div>
                      <div className="mt-2 text-sm font-bold text-white/90">{item.value}</div>
                    </div>
                  ))
                : details.map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-white/35">{item.label}</div>
                      <div className="mt-2 text-sm font-bold text-white/90">{item.value}</div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="relative">
            <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <img src={appLogo} alt="LuminaPlayer logo" className="h-16 w-16 rounded-2xl shadow-lg shadow-sky-950/40" />
              <div>
                <div className="text-xl font-bold">LuminaPlayer</div>
                <div className="mt-1 text-sm text-white/55">Local music library, lyrics, and desktop playback.</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] shadow-2xl shadow-sky-950/30">
              <img src={banner} alt="LuminaPlayer app preview" className="block w-full" />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 pb-8 md:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-300/12 text-sky-200">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {feature.icon}
                  </svg>
                </div>
                <h2 className="text-lg font-bold">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="requirements" className="mx-auto max-w-7xl px-5 py-12 md:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Sẵn sàng cho Windows desktop</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Tải bản cài đặt mới nhất từ GitHub Releases. Nếu trình duyệt cảnh báo file tải về,
                  bạn có thể kiểm tra mã nguồn trực tiếp trên GitHub.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {details.map((item) => (
                  <div key={item.label} className="rounded-xl bg-black/20 px-4 py-3">
                    <div className="text-xs text-white/35">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="mx-auto max-w-7xl px-5 pb-10 pt-4 text-sm text-white/35 md:px-8">
          <div className="flex flex-col gap-3 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
            <span>LuminaPlayer</span>
            <div className="flex gap-5">
              <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                GitHub
              </a>
              <a href={`https://github.com/${REPO}/releases`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Releases
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
