import React, { useEffect, useMemo, useState } from 'react';
import banner from '@/assets/banner.png';
import appLogo from '@/resources/icons/lumina-icon.png';

type AppRelease = {
  id: number;
  tagName: string;
  name: string;
  notes: string;
  downloadUrl: string | null;
  fileSize: string | null;
  releaseDate: string | null;
  isPrerelease: boolean;
};

type ReleaseNoteItem =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      src: string;
      alt: string;
    };

const REPO = 'NgocThachTN/LuminaPlayer';

const DownloadIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" />
  </svg>
);

const DiscIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="8" strokeWidth={2} />
    <circle cx="12" cy="12" r="2" strokeWidth={2} />
  </svg>
);

const FolderIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5V7Z" />
  </svg>
);

const LyricsIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18V5l10-2v13M9 18c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2Zm10-2c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2Z" />
  </svg>
);

const getImagePreviewUrl = (src: string) => {
  if (src.includes('github.com/user-attachments/assets/')) {
    return `/api/release-image?url=${encodeURIComponent(src)}`;
  }

  return src;
};

const ReleaseImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [imageSrc, setImageSrc] = useState(getImagePreviewUrl(src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImageSrc(getImagePreviewUrl(src));
    setFailed(false);
  }, [src]);

  return (
    <>
      {!failed && (
        <img
          src={imageSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="block max-h-[520px] w-full rounded-xl object-contain"
        />
      )}
      {failed && (
        <iframe
          src={getImagePreviewUrl(src)}
          title={alt}
          referrerPolicy="no-referrer"
          className="h-[520px] w-full rounded-xl border-0 bg-white"
        />
      )}
    </>
  );
};

const formatReleaseDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

const getAttributeValue = (html: string, attribute: string) =>
  html.match(new RegExp(`${attribute}="([^"]+)"`, 'i'))?.[1] || '';

const getReleaseDomId = (release: AppRelease) =>
  `release-${String(release.tagName || release.id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const getReleaseHash = (release: AppRelease) => `#${getReleaseDomId(release)}`;

const getReleaseIdFromHash = (releaseList: AppRelease[]) => {
  const currentHash = window.location.hash.toLowerCase();
  if (!currentHash) return null;

  return releaseList.find((release) => getReleaseHash(release).toLowerCase() === currentHash)?.id || null;
};

const formatReleaseNotes = (notes: string): ReleaseNoteItem[] => {
  const items = String(notes || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map<ReleaseNoteItem | null>((line) => {
      const markdownImage = line.match(/!\[(.*?)\]\((.*?)\)/);
      if (markdownImage) {
        return {
          type: 'image',
          alt: markdownImage[1] || 'Release preview',
          src: markdownImage[2],
        };
      }

      const htmlImage = line.match(/<img[^>]*>/i);
      if (htmlImage) {
        const src = getAttributeValue(htmlImage[0], 'src');
        if (src) {
          return {
            type: 'image',
            alt: getAttributeValue(htmlImage[0], 'alt') || 'Release preview',
            src,
          };
        }
      }

      const text = line
        .replace(/<[^>]+>/g, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1: $2')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*]\s*/, '')
        .trim();

      return text ? { type: 'text', text } : null;
    })
    .filter(Boolean);

  return items.length ? items.slice(0, 14) as ReleaseNoteItem[] : [{ type: 'text', text: 'No release notes were published for this version.' }];
};

export const DownloadRedirect: React.FC = () => {
  const [status, setStatus] = useState('Checking GitHub releases...');
  const [error, setError] = useState<string | null>(null);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);

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
    const fetchReleases = async () => {
      try {
        const allReleaseData: any[] = [];

        for (let page = 1; page <= 10; page += 1) {
          const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`);

          if (!response.ok) {
            throw new Error('Unable to read release information.');
          }

          const data = await response.json();
          if (!Array.isArray(data) || data.length === 0) break;

          allReleaseData.push(...data);
          if (data.length < 100) break;
        }

        const releaseList: AppRelease[] = allReleaseData.map((item: any) => {
            const assets = item.assets || [];
            const exeAsset = assets.find((asset: any) => String(asset.name || '').endsWith('.exe'));

            return {
              id: item.id,
              tagName: item.tag_name || item.name || 'Release',
              name: item.name || item.tag_name || 'Release',
              notes: item.body || '',
              downloadUrl: exeAsset?.browser_download_url || null,
              fileSize: exeAsset?.size ? `${(exeAsset.size / (1024 * 1024)).toFixed(1)} MB` : null,
              releaseDate: formatReleaseDate(item.published_at),
              isPrerelease: !!item.prerelease,
            };
          });

        if (!releaseList.length) {
          setError('No GitHub releases are published yet.');
          return;
        }

        setReleases(releaseList);
        setSelectedReleaseId(getReleaseIdFromHash(releaseList) || releaseList[0].id);
        setStatus('Ready to download');
      } catch (err) {
        console.error(err);
        setError('Could not connect to GitHub. Open Releases to download the installer manually.');
      }
    };

    fetchReleases();
  }, []);

  const selectedRelease = useMemo(
    () => releases.find((release) => release.id === selectedReleaseId) || releases[0] || null,
    [releases, selectedReleaseId]
  );

  useEffect(() => {
    if (!releases.length) return;

    const selectReleaseFromHash = () => {
      const releaseId = getReleaseIdFromHash(releases);
      if (releaseId) {
        setSelectedReleaseId(releaseId);
      }
    };

    selectReleaseFromHash();
    window.addEventListener('hashchange', selectReleaseFromHash);

    return () => window.removeEventListener('hashchange', selectReleaseFromHash);
  }, [releases]);

  useEffect(() => {
    if (!selectedRelease || !window.location.hash.startsWith('#release-')) return;

    window.requestAnimationFrame(() => {
      document.getElementById('release-notes')?.scrollIntoView({ block: 'start' });
    });
  }, [selectedRelease]);

  const releaseDetails = [
    { label: 'Version', value: selectedRelease?.tagName },
    { label: 'Installer', value: selectedRelease?.fileSize || 'GitHub asset' },
    { label: 'Published', value: selectedRelease?.releaseDate },
  ].filter((item) => item.value);

  const requirements = [
    { label: 'Platform', value: 'Windows 10 or later' },
    { label: 'Architecture', value: '64-bit' },
    { label: 'License', value: 'MIT' },
  ];

  const features = [
    {
      title: 'Built for local music',
      description: 'Import files and folders, keep your library on your machine, and play without accounts or ads.',
      icon: <FolderIcon />,
    },
    {
      title: 'Album-first playback',
      description: 'Browse your collection by songs, albums, and artists with artwork pulled from your own files.',
      icon: <DiscIcon />,
    },
    {
      title: 'Synced lyrics',
      description: 'Search and display timed lyrics while you listen, including a focused full-screen player.',
      icon: <LyricsIcon />,
    },
  ];

  const usageSteps = [
    {
      title: 'Download the installer',
      description: 'Click Download for Windows, open the setup file, and follow the installer steps.',
    },
    {
      title: 'Add your music folder',
      description: 'Open LuminaPlayer and choose Open Music Folder. Pick the folder where you keep your songs.',
    },
    {
      title: 'Choose how to browse',
      description: 'Use Playlist, Albums, or Artists. Search at the top when you want to find a song quickly.',
    },
    {
      title: 'Play and enjoy',
      description: 'Click a song to play it. Use the bottom player to pause, skip, change volume, open lyrics, or view the queue.',
    },
  ];

  const highlights = ['Local music', 'Windows installer', 'No sign-in'];

  const selectRelease = (releaseId: number) => {
    const release = releases.find((item) => item.id === releaseId);
    if (!release) return;

    setSelectedReleaseId(release.id);
    window.history.pushState(null, '', getReleaseHash(release));
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#061018] text-slate-100">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_4%,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(14,116,144,0.18),transparent_28%),linear-gradient(180deg,#071827_0%,#061018_44%,#04080d_100%)]" />

      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#061018]/86 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <a href="/download" className="flex items-center gap-3 rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300">
            <img src={appLogo} alt="LuminaPlayer logo" className="h-11 w-11 rounded-xl shadow-[0_0_24px_rgba(56,189,248,0.28)]" />
            <div>
              <div className="text-base font-extrabold tracking-tight text-white">LuminaPlayer</div>
              <div className="text-xs font-semibold text-cyan-200/72">Desktop music player</div>
            </div>
          </a>

          <nav className="hidden items-center gap-1 text-sm font-semibold text-slate-300 md:flex">
            <a href="#download" className="rounded-full px-4 py-2 transition hover:bg-white/8 hover:text-white">Download</a>
            <a href="#how-to-use" className="rounded-full px-4 py-2 transition hover:bg-white/8 hover:text-white">How to use</a>
            <a href="#release-notes" className="rounded-full px-4 py-2 transition hover:bg-white/8 hover:text-white">Releases</a>
            <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2 transition hover:bg-white/8 hover:text-white">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-10 pt-10 md:px-8 md:pb-14 md:pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              Official download for Windows
            </div>
            <h1 className="max-w-xl text-4xl font-black leading-tight tracking-normal text-white md:text-6xl">
              LuminaPlayer makes your local music feel simple again.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 md:text-lg">
              Install the desktop player, import your music folder, then browse songs, albums, artists, artwork, and lyrics in one calm place.
            </p>

            <div id="download" className="mt-7 max-w-xl rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-5">
              <div className="grid gap-5">
                <div className="flex items-center gap-4">
                  <img src={appLogo} alt="" className="h-14 w-14 rounded-2xl shadow-[0_0_28px_rgba(56,189,248,0.28)]" />
                  <div>
                    <div className="text-sm font-semibold text-cyan-200">Latest version</div>
                    <div className="mt-1 text-2xl font-black text-white">{selectedRelease?.tagName || 'LuminaPlayer'}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {selectedRelease?.fileSize ? `${selectedRelease.fileSize} Windows installer` : 'Windows installer from GitHub Releases'}
                    </div>
                  </div>
                </div>

                <div>
                  {selectedRelease?.downloadUrl ? (
                    <a
                      href={selectedRelease.downloadUrl}
                      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-300 px-6 py-4 text-base font-black text-slate-950 shadow-[0_16px_34px_rgba(34,211,238,0.24)] transition hover:bg-cyan-200 sm:w-auto"
                    >
                      <DownloadIcon />
                      Download for Windows
                    </a>
                  ) : error ? (
                    <a
                      href={`https://github.com/${REPO}/releases/latest`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/8 px-6 py-4 text-base font-black text-white transition hover:bg-white/12 sm:w-auto"
                    >
                      Open GitHub Releases
                    </a>
                  ) : (
                    <div className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-black/20 px-6 py-4 text-base font-black text-slate-300 sm:w-auto">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-200/20 border-t-cyan-200" />
                      {status}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</p>}

              <div className="mt-5 grid gap-3 border-t border-white/8 pt-5 sm:grid-cols-3">
                {(releaseDetails.length > 0 ? releaseDetails : requirements).map((item) => (
                  <div key={item.label} className="rounded-2xl bg-black/18 px-4 py-3">
                    <div className="text-xs font-semibold text-slate-400">{item.label}</div>
                    <div className="mt-1 text-sm font-black text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex max-w-xl flex-wrap gap-2">
              {highlights.map((item) => (
                <span key={item} className="rounded-full bg-white/[0.07] px-4 py-2 text-sm font-semibold text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
            <img src={banner} alt="LuminaPlayer app preview" className="block w-full rounded-2xl" />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-8 md:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-3xl bg-white/[0.065] p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                  {feature.icon}
                </div>
                <h2 className="text-lg font-black text-white">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-to-use" className="mx-auto max-w-6xl px-5 py-12 md:px-8">
          <div className="grid gap-8 rounded-3xl bg-white/[0.06] p-5 md:p-8 lg:grid-cols-[340px_1fr]">
            <div>
              <div className="text-sm font-semibold text-cyan-200">Quick start</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Start in 4 simple steps</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                This is the fastest way to begin. Download the app, add your music folder, then play your songs.
              </p>
              <a
                href="#download"
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                Start with download
              </a>
            </div>

            <div className="grid gap-3">
              {usageSteps.map((step, index) => (
                <article key={step.title} className="grid gap-4 rounded-2xl bg-black/18 p-4 sm:grid-cols-[52px_1fr]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-base font-black text-slate-950">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="release-notes" className="mx-auto max-w-6xl px-5 py-12 md:px-8">
          <div className="mb-6 grid gap-4 md:grid-cols-[1fr_280px] md:items-end">
            <div>
              <div className="text-sm font-semibold text-cyan-200">Release notes</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal text-white">Choose a version</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Pick any release to see what changed. Screenshots and notes are pulled from GitHub Releases.
              </p>
            </div>

            {releases.length > 0 && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Version</span>
                <select
                  value={selectedRelease?.id || ''}
                  onChange={(event) => selectRelease(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1722] px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300"
                >
                  {releases.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.tagName} {release.releaseDate ? `- ${release.releaseDate}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="rounded-3xl bg-white/[0.06] p-4 md:p-6">
            {releases.length > 0 && selectedRelease ? (
              <article key={selectedRelease.id} id={getReleaseDomId(selectedRelease)}>
                <div className="grid gap-5 border-b border-white/8 pb-5 md:grid-cols-[1fr_auto] md:items-start">
                  <div>
                    <h3 className="text-2xl font-black text-white">{selectedRelease.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-cyan-300/14 px-3 py-1.5 text-cyan-100">{selectedRelease.tagName}</span>
                      {selectedRelease.isPrerelease && <span className="rounded-full bg-amber-300/14 px-3 py-1.5 text-amber-100">Pre-release</span>}
                      {selectedRelease.fileSize && <span className="rounded-full bg-white/8 px-3 py-1.5 text-slate-300">{selectedRelease.fileSize}</span>}
                      {selectedRelease.releaseDate && <span className="rounded-full bg-white/8 px-3 py-1.5 text-slate-300">{selectedRelease.releaseDate}</span>}
                    </div>
                  </div>

                  {selectedRelease.downloadUrl && (
                    <a
                      href={selectedRelease.downloadUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-black text-white transition hover:bg-cyan-300 hover:text-slate-950"
                    >
                      <DownloadIcon />
                      Download this version
                    </a>
                  )}
                </div>

                <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                  {formatReleaseNotes(selectedRelease.notes).map((item, index) =>
                    item.type === 'image' ? (
                      <a
                        key={`${selectedRelease.id}-${index}`}
                        href={item.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-2xl bg-black/24 p-2 transition hover:bg-black/32"
                      >
                        <ReleaseImage src={item.src} alt={item.alt} />
                        <span className="mt-3 block px-2 pb-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                          Open image
                        </span>
                      </a>
                    ) : (
                      <div key={`${selectedRelease.id}-${index}`} className="rounded-2xl bg-black/18 px-4 py-3">
                        {item.text}
                      </div>
                    )
                  )}
                </div>
              </article>
            ) : (
              <div className="p-4 text-sm font-semibold text-slate-400">{status}</div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-14 md:px-8">
          <div className="grid gap-5 rounded-3xl bg-white/[0.06] p-5 md:grid-cols-[1fr_1.3fr] md:p-8">
            <div>
              <h2 className="text-2xl font-black tracking-normal text-white">Before you install</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                If Windows SmartScreen appears, review the GitHub source code and release assets before continuing.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {requirements.map((item) => (
                <div key={item.label} className="rounded-2xl bg-black/18 p-4">
                  <div className="text-xs font-semibold text-slate-400">{item.label}</div>
                  <div className="mt-1 text-sm font-black text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="mx-auto max-w-6xl px-5 pb-10 text-sm font-semibold text-slate-500 md:px-8">
          <div className="flex flex-col gap-3 border-t border-white/8 pt-6 md:flex-row md:items-center md:justify-between">
            <span>LuminaPlayer for Windows</span>
            <div className="flex gap-5">
              <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-200">
                Source code
              </a>
              <a href={`https://github.com/${REPO}/releases`} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-200">
                All releases
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
