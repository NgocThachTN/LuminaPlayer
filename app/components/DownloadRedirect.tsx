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
          className="block max-h-[420px] w-full object-contain"
        />
      )}
      {failed && (
        <iframe
          src={getImagePreviewUrl(src)}
          title={alt}
          referrerPolicy="no-referrer"
          className="h-[420px] w-full border-0 bg-white"
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#03070b] text-[#e8f7ff]">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_28%_12%,rgba(14,165,233,0.34),transparent_34%),linear-gradient(180deg,rgba(3,105,161,0.18)_0%,rgba(3,7,11,0)_48%)]" />
      <div className="fixed inset-0 pointer-events-none opacity-[0.12] [background-image:linear-gradient(#7dd3fc_1px,transparent_1px),linear-gradient(90deg,#7dd3fc_1px,transparent_1px)] [background-size:34px_34px]" />

      <header className="relative z-10 border-b border-sky-300/15 bg-[#050b12]/86 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <a href="/download" className="flex items-center gap-3">
            <img src={appLogo} alt="LuminaPlayer logo" className="h-12 w-12 rounded-[10px] shadow-[0_0_24px_rgba(14,165,233,0.38)]" />
            <div>
              <div className="text-base font-black tracking-tight text-white">LuminaPlayer</div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Desktop music player</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-sky-100/62 md:flex">
            <a href="#download" className="transition hover:text-sky-200">Download</a>
            <a href="#release-notes" className="transition hover:text-sky-200">Release notes</a>
            <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer" className="transition hover:text-sky-200">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 pt-10 md:px-8 md:pb-16 md:pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 border-y border-sky-300/35 py-2 text-xs font-black uppercase tracking-[0.22em] text-sky-200">
              Official Windows installer
            </div>

            <h1 className="max-w-2xl font-serif text-5xl font-black leading-[0.95] tracking-normal text-white md:text-7xl">
              Download LuminaPlayer
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-sky-50/70">
              A focused desktop player for people who still keep music files. Import your local library, see album art,
              follow synced lyrics, and listen without a subscription getting in the way.
            </p>

            <div id="download" className="mt-8 max-w-xl border border-sky-300/22 bg-[#07111c]/92 p-4 shadow-[6px_6px_0_#0ea5e9]">
              <div className="flex items-start gap-4">
                <img src={appLogo} alt="" className="h-16 w-16 rounded-[12px] shadow-[0_0_22px_rgba(56,189,248,0.26)]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black uppercase tracking-[0.16em] text-sky-200">Lumina Music Player</div>
                  <div className="mt-1 text-sm leading-6 text-sky-50/60">
                    {selectedRelease ? `${selectedRelease.tagName} setup package, delivered from GitHub Releases.` : 'Windows setup package, delivered from GitHub Releases.'}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {selectedRelease?.downloadUrl ? (
                  <a
                    href={selectedRelease.downloadUrl}
                    className="inline-flex w-full items-center justify-center gap-3 bg-sky-400 px-5 py-4 text-base font-black text-[#03101a] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] transition hover:bg-sky-300 sm:w-auto"
                  >
                    <DownloadIcon />
                    Download for Windows
                  </a>
                ) : error ? (
                  <a
                    href={`https://github.com/${REPO}/releases/latest`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center bg-sky-950 px-5 py-4 text-base font-black text-sky-50 transition hover:bg-sky-900 sm:w-auto"
                  >
                    Open GitHub Releases
                  </a>
                ) : (
                  <div className="inline-flex w-full items-center justify-center gap-3 border border-sky-300/20 bg-sky-950/70 px-5 py-4 text-base font-black text-sky-100/72 sm:w-auto">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200/20 border-t-sky-200" />
                    {status}
                  </div>
                )}
              </div>

              {error && <p className="mt-4 text-sm font-semibold text-red-300">{error}</p>}

              <dl className="mt-5 grid gap-3 border-t border-sky-300/15 pt-4 sm:grid-cols-3">
                {(releaseDetails.length > 0 ? releaseDetails : requirements).map((item) => (
                  <div key={item.label}>
                    <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-200/45">{item.label}</dt>
                    <dd className="mt-1 text-sm font-black text-sky-50">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="lg:pl-6">
            <div className="border border-sky-300/18 bg-[#02060a] p-3 shadow-[10px_10px_0_#075985]">
              <div className="mb-3 flex items-center justify-between border-b border-sky-200/12 px-2 pb-3">
                <div className="flex items-center gap-3">
                  <img src={appLogo} alt="LuminaPlayer" className="h-9 w-9 rounded-[8px]" />
                  <div>
                    <div className="text-sm font-black text-white">LuminaPlayer</div>
                    <div className="text-xs text-sky-200/58">Local library preview</div>
                  </div>
                </div>
                <div className="hidden text-xs font-bold uppercase tracking-[0.16em] text-sky-200/58 sm:block">No sign-in required</div>
              </div>
              <img src={banner} alt="LuminaPlayer app preview" className="block w-full border border-sky-200/10" />
            </div>
          </div>
        </section>

        <section id="release-notes" className="mx-auto max-w-6xl px-5 pb-12 md:px-8">
          <div className="border border-sky-300/18 bg-[#06101a]/92">
            <div className="border-b border-sky-300/15 p-5 md:p-6">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">GitHub release notes</div>
              <h2 className="mt-2 font-serif text-3xl font-black tracking-normal text-white">Version history</h2>
            </div>

            {releases.length > 0 ? (
              <div className="grid md:grid-cols-[240px_1fr]">
                <div className="flex gap-2 overflow-x-auto border-b border-sky-300/15 p-3 md:sticky md:top-4 md:block md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
                  {releases.map((release) => {
                    const isSelected = release.id === selectedRelease?.id;

                    return (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() => {
                          setSelectedReleaseId(release.id);
                          window.history.pushState(null, '', getReleaseHash(release));
                          window.requestAnimationFrame(() => {
                            document.getElementById('release-notes')?.scrollIntoView({ block: 'start' });
                          });
                        }}
                        className={`block min-w-[150px] border px-4 py-3 text-left transition md:mb-2 md:w-full ${
                          isSelected
                            ? 'border-sky-300 bg-sky-300 text-[#03101a]'
                            : 'border-sky-300/15 bg-[#02070d] text-sky-100/70 hover:border-sky-300/45 hover:text-sky-50'
                        }`}
                      >
                        <span className="block text-sm font-black">{release.tagName}</span>
                        <span className={`mt-1 block text-xs font-semibold ${isSelected ? 'text-[#03101a]/72' : 'text-sky-200/46'}`}>
                          {release.releaseDate || 'Unpublished'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedRelease && (
                  <article key={selectedRelease.id} id={getReleaseDomId(selectedRelease)} className="p-5 md:p-6">
                      <div className="flex flex-col gap-3 border-b border-sky-300/12 pb-5 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-2xl font-black text-white">{selectedRelease.name}</h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em]">
                            <span className="border border-sky-300/18 bg-sky-950/55 px-3 py-1 text-sky-200">{selectedRelease.tagName}</span>
                            {selectedRelease.isPrerelease && <span className="border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-amber-200">Pre-release</span>}
                            {selectedRelease.fileSize && <span className="border border-sky-300/18 bg-sky-950/55 px-3 py-1 text-sky-200">{selectedRelease.fileSize}</span>}
                            {selectedRelease.releaseDate && <span className="border border-sky-300/18 bg-sky-950/55 px-3 py-1 text-sky-200">{selectedRelease.releaseDate}</span>}
                          </div>
                        </div>

                        {selectedRelease.downloadUrl && (
                          <a
                            href={selectedRelease.downloadUrl}
                            className="inline-flex items-center justify-center gap-2 border border-sky-300/30 px-4 py-3 text-sm font-black text-sky-100 transition hover:bg-sky-300 hover:text-[#03101a]"
                          >
                            <DownloadIcon />
                            Download this version
                          </a>
                        )}
                      </div>

                      <div className="mt-5 space-y-4 text-sm leading-7 text-sky-50/72">
                        {formatReleaseNotes(selectedRelease.notes).map((item, index) =>
                          item.type === 'image' ? (
                            <a
                              key={`${selectedRelease.id}-${index}`}
                              href={item.src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden border border-sky-300/18 bg-[#02070d] p-2 transition hover:border-sky-300/45"
                            >
                              <ReleaseImage src={item.src} alt={item.alt} />
                              <span className="mt-2 block text-xs font-black uppercase tracking-[0.16em] text-sky-300">
                                Open image
                              </span>
                            </a>
                          ) : (
                            <div key={`${selectedRelease.id}-${index}`} className="border-l-2 border-sky-300/36 pl-4">
                              {item.text}
                            </div>
                          )
                        )}
                      </div>
                    </article>
                )}
              </div>
            ) : (
              <div className="p-6 text-sm font-semibold text-sky-100/62">{status}</div>
            )}
          </div>
        </section>

        <section id="features" className="border-y border-sky-300/15 bg-[#07111c]/72">
          <div className="mx-auto grid max-w-6xl gap-px px-5 py-10 md:grid-cols-3 md:px-8">
            {features.map((feature) => (
              <article key={feature.title} className="bg-[#08131f] p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center bg-sky-300 text-[#03101a]">
                  {feature.icon}
                </div>
                <h2 className="text-lg font-black text-white">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-sky-50/58">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12 md:px-8">
          <div className="grid gap-8 border-t border-sky-300/15 pt-8 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-serif text-3xl font-black tracking-normal text-white">Before you install</h2>
              <p className="mt-3 max-w-lg text-sm leading-7 text-sky-50/62">
                The installer is published with each release. If Windows SmartScreen asks for confirmation, you can
                review the source code and release assets on GitHub before continuing.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {requirements.map((item) => (
                <div key={item.label} className="border border-sky-300/18 bg-[#07111c] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-200/45">{item.label}</div>
                  <div className="mt-2 text-sm font-black text-sky-50">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="mx-auto max-w-6xl px-5 pb-10 text-sm font-semibold text-sky-100/42 md:px-8">
          <div className="flex flex-col gap-3 border-t border-sky-300/15 pt-6 md:flex-row md:items-center md:justify-between">
            <span>LuminaPlayer for Windows</span>
            <div className="flex gap-5">
              <a href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer" className="hover:text-sky-200">
                Source code
              </a>
              <a href={`https://github.com/${REPO}/releases`} target="_blank" rel="noopener noreferrer" className="hover:text-sky-200">
                All releases
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
