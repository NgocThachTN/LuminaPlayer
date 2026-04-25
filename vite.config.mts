import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YOUTUBE_MUSIC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};
const YOUTUBE_MUSIC_CONFIG_TTL_MS = 1000 * 60 * 60 * 12;
let youTubeMusicConfig: any = null;
let youTubeMusicConfigFetchedAt = 0;

async function getYouTubeMusicConfig() {
  if (
    youTubeMusicConfig &&
    Date.now() - youTubeMusicConfigFetchedAt < YOUTUBE_MUSIC_CONFIG_TTL_MS
  ) {
    return youTubeMusicConfig;
  }

  const response = await fetch('https://music.youtube.com/', {
    headers: YOUTUBE_MUSIC_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`YouTube Music bootstrap failed: ${response.status}`);
  }

  const html = await response.text();
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const context = html.match(/"INNERTUBE_CONTEXT":(\{.*?\}),"INNERTUBE_CONTEXT_CLIENT_NAME"/s)?.[1];
  if (!apiKey || !context) {
    throw new Error('YouTube Music bootstrap payload missing API config');
  }

  youTubeMusicConfig = { apiKey, context: JSON.parse(context) };
  youTubeMusicConfigFetchedAt = Date.now();
  return youTubeMusicConfig;
}

function getRunsText(runs: any[]) {
  return Array.isArray(runs)
    ? runs.map((run) => run?.text || '').join('').trim()
    : '';
}

function normalizeComparable(value: string) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeLyricsComparable(value: string) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .replace(/\b(?:feat|ft|featuring|official|audio|video|lyrics|mv|version)\b/gi, ' ')
    .replace(/[()[\]{}'"`~!@#$%^&*_+=|\\:;,.<>/?-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLatinTokens(value: string) {
  return normalizeLyricsComparable(value)
    .split(/\s+/)
    .filter((token) => /^[a-z0-9]+$/.test(token) && token.length >= 2);
}

function getNonLatinCompact(value: string) {
  return normalizeLyricsComparable(value)
    .replace(/[a-z0-9\s]/g, '')
    .replace(/\s+/g, '');
}

function stripJapaneseDecorations(value: string) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s*[-–—:：]\s*[A-Za-z0-9][A-Za-z0-9\s'’!?.,-]*$/g, '')
    .replace(/\s*\([^)]*[A-Za-z][^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getArtistAliases(artist: string) {
  const normalized = normalizeLyricsComparable(artist).replace(/\s+/g, '');
  const aliases: string[] = [];

  if (normalized.includes('hinatazaka46')) aliases.push('日向坂46');
  if (normalized.includes('sakurazaka46')) aliases.push('櫻坂46', '欅坂46');
  if (normalized.includes('keyakizaka46')) aliases.push('欅坂46');
  if (normalized.includes('nogizaka46')) aliases.push('乃木坂46');

  return aliases.filter((alias, index) => aliases.indexOf(alias) === index);
}

function buildLyricsQueries(title: string, artist: string, album = '') {
  const rawTitle = String(title || '').trim();
  const rawArtist = String(artist || '').trim();
  const rawAlbum = String(album || '').trim();
  const artistAliases = getArtistAliases(rawArtist);
  const japaneseTitle = stripJapaneseDecorations(rawTitle);
  const titleTokens = getLatinTokens(rawTitle);
  const hasNonLatinTitle = !!getNonLatinCompact(rawTitle);
  const compactTitle = normalizeLyricsComparable(rawTitle).replace(/\s+/g, '');
  const queries = [
    rawArtist && rawTitle ? `${rawArtist} ${rawTitle}` : rawTitle,
    rawArtist && rawAlbum && rawTitle ? `${rawArtist} ${rawAlbum} ${rawTitle}` : '',
    rawAlbum && rawTitle ? `${rawAlbum} ${rawTitle}` : '',
    ...artistAliases.flatMap((alias) => [
      rawTitle ? `${alias} ${rawTitle}` : '',
      rawAlbum && rawTitle ? `${alias} ${rawAlbum} ${rawTitle}` : '',
      japaneseTitle && japaneseTitle !== rawTitle ? `${alias} ${japaneseTitle}` : '',
    ]),
    rawArtist && japaneseTitle && japaneseTitle !== rawTitle ? `${rawArtist} ${japaneseTitle}` : '',
    rawArtist && titleTokens.length ? `${rawArtist} ${titleTokens.join(' ')}` : '',
    rawArtist && compactTitle && compactTitle !== normalizeLyricsComparable(rawTitle) ? `${rawArtist} ${compactTitle}` : '',
    rawArtist && hasNonLatinTitle ? rawArtist : '',
    rawTitle,
    japaneseTitle !== rawTitle ? japaneseTitle : '',
  ];

  return queries
    .map((query) => query.trim())
    .filter(Boolean)
    .filter((query, index, list) => list.indexOf(query) === index);
}

function textMatchesLoosely(wanted: string, candidate: string) {
  const wantedNorm = normalizeLyricsComparable(wanted);
  const candidateNorm = normalizeLyricsComparable(candidate);
  if (!wantedNorm || !candidateNorm) return true;

  const wantedNonLatin = getNonLatinCompact(wanted);
  const candidateNonLatin = getNonLatinCompact(candidate);
  if (wantedNonLatin && candidateNonLatin) {
    return candidateNonLatin.includes(wantedNonLatin) ||
      wantedNonLatin.includes(candidateNonLatin);
  }

  const wantedCompact = wantedNorm.replace(/\s+/g, '');
  const candidateCompact = candidateNorm.replace(/\s+/g, '');
  if (
    candidateNorm.includes(wantedNorm) ||
    wantedNorm.includes(candidateNorm) ||
    candidateCompact.includes(wantedCompact) ||
    wantedCompact.includes(candidateCompact)
  ) {
    return true;
  }

  const wantedLatin = getLatinTokens(wanted);
  const candidateLatin = getLatinTokens(candidate);
  if (wantedLatin.length > 0) {
    return wantedLatin.every((token) =>
      candidateLatin.some(
        (candidateToken) =>
          candidateToken.includes(token) || token.includes(candidateToken)
      )
    );
  }

  return false;
}

function getTextSegments(runs: any[]) {
  return getRunsText(runs)
    .split(/\s*(?:\u2022|\u00b7)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getRendererVideoId(renderer: any) {
  return (
    renderer?.playlistItemData?.videoId ||
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
      ?.runs?.find((run: any) => run?.navigationEndpoint?.watchEndpoint?.videoId)
      ?.navigationEndpoint?.watchEndpoint?.videoId ||
    null
  );
}

function collectSongCandidates(node: any, results: any[] = []) {
  if (!node || typeof node !== 'object') return results;
  if (Array.isArray(node)) {
    for (const entry of node) collectSongCandidates(entry, results);
    return results;
  }

  const renderer = node.musicResponsiveListItemRenderer;
  if (renderer) {
    const title = getRunsText(
      renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
    );
    const segments = getTextSegments(
      renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
    );
    const type = normalizeComparable(segments[0]);
    const album = type === 'song' ? segments[2] || '' : '';
    const videoId = getRendererVideoId(renderer);
    if (title && videoId && (type === 'song' || type === 'video') && !results.some((r) => r.videoId === videoId)) {
      results.push({ title, artist: segments[1] || '', album, type, videoId });
    }
  }

  for (const value of Object.values(node)) collectSongCandidates(value, results);
  return results;
}

function collectBrowseEndpoints(node: any, results: any[] = []) {
  if (!node || typeof node !== 'object') return results;
  if (Array.isArray(node)) {
    for (const entry of node) collectBrowseEndpoints(entry, results);
    return results;
  }

  if (node.browseEndpoint?.browseId) results.push(node.browseEndpoint);
  for (const value of Object.values(node)) collectBrowseEndpoints(value, results);
  return results;
}

function collectLyricsTexts(node: any, results: string[] = []) {
  if (!node || typeof node !== 'object') return results;
  if (Array.isArray(node)) {
    for (const entry of node) collectLyricsTexts(entry, results);
    return results;
  }

  const description = getRunsText(node.musicDescriptionShelfRenderer?.description?.runs);
  if (description) results.push(description);
  for (const value of Object.values(node)) collectLyricsTexts(value, results);
  return results;
}

function collectTimedLyrics(node: any, results: any[][] = []) {
  if (!node || typeof node !== 'object') return results;
  if (Array.isArray(node)) {
    if (
      node.some((entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry.lyricLine || entry.text || entry.line) &&
        (entry.cueRange || entry.startTimeMilliseconds || entry.startTimeMs || entry.startTimeSeconds)
      )
    ) {
      results.push(node);
    }

    for (const entry of node) collectTimedLyrics(entry, results);
    return results;
  }

  const timedData =
    node.timedLyricsModel?.lyricsData?.timedLyricsData ||
    node.lyricsData?.timedLyricsData ||
    node.timedLyricsData;
  if (Array.isArray(timedData)) results.push(timedData);
  for (const value of Object.values(node)) collectTimedLyrics(value, results);
  return results;
}

function parseYouTubeMusicTimeSeconds(value: any, unit = 'seconds') {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' && value.includes(':')) {
    const parts = value.split(':').map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return unit === 'milliseconds' ? numeric / 1000 : numeric;
}

function parseTimedLyrics(timedData: any[]) {
  if (!Array.isArray(timedData)) return [];

  return timedData
    .map((entry) => {
      const text = String(
        entry?.lyricLine ||
        entry?.line ||
        entry?.text?.runs?.map((run: any) => run?.text || '').join('') ||
        entry?.text ||
        ''
      ).trim();
      const time =
        parseYouTubeMusicTimeSeconds(entry?.cueRange?.startTimeMilliseconds, 'milliseconds') ??
        parseYouTubeMusicTimeSeconds(entry?.startTimeMilliseconds, 'milliseconds') ??
        parseYouTubeMusicTimeSeconds(entry?.startTimeMs, 'milliseconds') ??
        parseYouTubeMusicTimeSeconds(entry?.cueRange?.startTimeSeconds) ??
        parseYouTubeMusicTimeSeconds(entry?.startTimeSeconds) ??
        parseYouTubeMusicTimeSeconds(entry?.startTime);
      if (!text || time === null) return null;
      return { time, text };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.time - b.time);
}

async function fetchYouTubeMusicEndpoint(endpoint: 'search' | 'next' | 'browse', body: any, referer: string, clientOverride: any = null) {
  const config = await getYouTubeMusicConfig();
  const context = JSON.parse(JSON.stringify(config.context));
  if (context?.client) {
    context.client.originalUrl = referer;
    if (clientOverride) {
      Object.assign(context.client, clientOverride);
    }
  }

  const response = await fetch(
    `https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false&key=${config.apiKey}`,
    {
      method: 'POST',
      headers: {
        ...YOUTUBE_MUSIC_HEADERS,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: 'https://music.youtube.com',
        Referer: referer,
      },
      body: JSON.stringify({ context, ...body }),
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube Music ${endpoint} failed: ${response.status}`);
  }

  return response.json();
}

async function fetchYouTubeMusicLyrics(title: string, artist: string, album = '') {
  const queries = buildLyricsQueries(title, artist, album);
  const wantedArtist = normalizeLyricsComparable(artist);
  const artistIsUnknown =
    !wantedArtist ||
    wantedArtist === 'unknown artist' ||
    wantedArtist === 'unknown';
  let plainFallback: any = null;

  const scoreCandidate = (candidate: any) => {
    const wantedTitle = normalizeLyricsComparable(title);
    const resultTitle = normalizeLyricsComparable(candidate?.title);
    const wantedAlbum = normalizeLyricsComparable(album);
    const resultAlbum = normalizeLyricsComparable(candidate?.album);
    const titleCompact = wantedTitle.replace(/\s+/g, '');
    const resultCompact = resultTitle.replace(/\s+/g, '');
    let score = 0;

    if (candidate?.type === 'song') score += 50;
    if (candidate?.type === 'video') score += 10;
    if (wantedTitle && resultTitle === wantedTitle) score += 80;
    else if (titleCompact && resultCompact === titleCompact) score += 70;
    else if (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)) score += 35;
    if (
      /\b(?:off\s*vocal|instrumental|karaoke)\b/.test(resultTitle) &&
      !/\b(?:off\s*vocal|instrumental|karaoke)\b/.test(wantedTitle)
    ) {
      score -= 45;
    }
    if (textMatchesLoosely(artist, candidate?.artist)) score += 30;
    if (
      wantedAlbum &&
      resultAlbum &&
      (resultAlbum.includes(wantedAlbum) || wantedAlbum.includes(resultAlbum))
    ) {
      score += 25;
    }
    return score;
  };

  for (const query of queries) {
    try {
      const searchUrl = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
      const searchData = await fetchYouTubeMusicEndpoint('search', { query }, searchUrl);
      const candidates = collectSongCandidates(searchData);
      const ordered = candidates
        .filter((candidate) => {
          return textMatchesLoosely(title, candidate.title) &&
            (artistIsUnknown || textMatchesLoosely(artist, candidate.artist));
        })
        .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

      for (const candidate of ordered.slice(0, 5)) {
        const watchUrl = `https://music.youtube.com/watch?v=${candidate.videoId}`;
        const nextData = await fetchYouTubeMusicEndpoint('next', { videoId: candidate.videoId }, watchUrl);
        const lyricsEndpoint = collectBrowseEndpoints(nextData)
          .find((endpoint) => String(endpoint.browseId || '').startsWith('MPLY'));
        if (!lyricsEndpoint?.browseId) continue;

        let synced: any[] | undefined;
        const mobileClients = [
          { clientName: 'ANDROID_MUSIC', clientVersion: '7.21.50' },
          { clientName: 'IOS_MUSIC', clientVersion: '7.21.50' },
        ];

        for (const client of mobileClients) {
          try {
            const timedBrowseData = await fetchYouTubeMusicEndpoint(
              'browse',
              { browseId: lyricsEndpoint.browseId, params: lyricsEndpoint.params },
              watchUrl,
              client
            );
            synced = collectTimedLyrics(timedBrowseData)
              .map(parseTimedLyrics)
              .find((lyrics) => lyrics.length > 0);
            if (synced?.length) break;
          } catch (error) {
            console.warn(`YouTube Music timed lyrics failed (${client.clientName}):`, error);
          }
        }

        if (synced?.length) {
          return {
            lyrics: synced.map((line: any) => line.text).join('\n'),
            synced,
            videoId: candidate.videoId,
            title: candidate.title,
            artist: candidate.artist,
          };
        }

        const browseData = await fetchYouTubeMusicEndpoint(
          'browse',
          { browseId: lyricsEndpoint.browseId, params: lyricsEndpoint.params },
          watchUrl
        );
        const lyrics = collectLyricsTexts(browseData).sort((a, b) => b.length - a.length)[0];
        if (lyrics) {
          plainFallback ??= { lyrics, videoId: candidate.videoId, title: candidate.title, artist: candidate.artist };
        }
      }
    } catch (error) {
      console.warn(`YouTube Music lyrics lookup failed (${query}):`, error);
    }
  }

  return plainFallback;
}

function youtubeMusicLyricsDevProxy() {
  return {
    name: 'youtube-music-lyrics-dev-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/youtube-music-lyrics', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const title = requestUrl.searchParams.get('title') || '';
          const artist = requestUrl.searchParams.get('artist') || '';
          const album = requestUrl.searchParams.get('album') || '';

          if (!title || !artist) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing title or artist' }));
            return;
          }

          const lyrics = await fetchYouTubeMusicLyrics(title, artist, album);
          if (!lyrics) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Lyrics not found' }));
            return;
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(lyrics));
        } catch (error: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error?.message || 'YouTube Music lookup failed' }));
        }
      });
    },
  };
}

function releaseImageDevProxy() {
  return {
    name: 'release-image-dev-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/release-image', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const imageUrl = requestUrl.searchParams.get('url') || '';
          const parsedUrl = new URL(imageUrl);
          const isGitHubAttachment =
            parsedUrl.hostname === 'github.com' &&
            parsedUrl.pathname.startsWith('/user-attachments/assets/');

          if (!isGitHubAttachment) {
            res.statusCode = 400;
            res.end('Unsupported release image URL');
            return;
          }

          const response = await fetch(parsedUrl.toString(), {
            headers: {
              'User-Agent': YOUTUBE_MUSIC_HEADERS['User-Agent'],
              Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.end('Release image not found');
            return;
          }

          const contentType = response.headers.get('content-type') || 'image/png';
          if (!contentType.startsWith('image/')) {
            res.statusCode = 415;
            res.end('Release asset is not an image');
            return;
          }

          const imageBuffer = Buffer.from(await response.arrayBuffer());
          res.statusCode = 200;
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(imageBuffer);
        } catch (error: any) {
          res.statusCode = 500;
          res.end(error?.message || 'Release image proxy failed');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', // Important for Electron - use relative paths
      server: {
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react(), youtubeMusicLyricsDevProxy(), releaseImageDevProxy()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'jsmediatags': path.resolve(__dirname, 'node_modules/jsmediatags/dist/jsmediatags.min.js'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true
      }
    };
});



