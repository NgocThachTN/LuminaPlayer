const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const APP_ID = "com.lumina.musicplayer";
const APP_ICON_PATH = path.join(__dirname, "../resources/icons/lumina-icon.png");
// Discord RPC is dynamically imported as ESM in initDiscordRPC()
require("dotenv").config({ path: path.join(__dirname, "../.env") });

if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

// Discord Rich Presence Configuration
// Create your app at: https://discord.com/developers/applications

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID; // Loaded from .env
const COVER_LOOKUP_USER_AGENT = "LuminaPlayer/2.1 (Discord Rich Presence cover lookup)";
const YOUTUBE_MUSIC_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};
let rpc = null;
let rpcReady = false;
let lastPresence = null; // Cache for reconnection
let lastCoverUrl = null; // Cache for fetched cover art URL
let lastCoverLookupKey = null;
let ActivityType = null;
let StatusDisplayType = null;

// Initialize Discord RPC with @xhayper/discord-rpc (ESM module)
let rpcHeartbeatInterval = null;

async function initDiscordRPC() {
  try {
    // Dynamic import for ESM module
    const rpcModule = await import("@xhayper/discord-rpc");
    const { Client } = rpcModule;
    ActivityType = rpcModule.ActivityType;
    StatusDisplayType = rpcModule.StatusDisplayType;

    rpc = new Client({
      clientId: DISCORD_CLIENT_ID,
    });

    rpc.on("ready", () => {
      console.log("Discord RPC Connected!");
      rpcReady = true;

      // Restore last known presence upon connection
      if (lastPresence && lastPresence.isPlaying) {
        updateDiscordPresence(lastPresence);
      } else {
        rpc.user?.setActivity({
          name: "Lumina Music Player",
          details: "Idle",
          state: "Not playing anything",
          type: ActivityType?.Playing,
          statusDisplayType: StatusDisplayType?.DETAILS,
          largeImageKey: "lumina_icon",
          largeImageText: "Lumina Music Player",
        });
      }
    });

    rpc.on("disconnected", () => {
      console.log("Discord RPC Disconnected.");
      rpcReady = false;
    });

    // Login to Discord
    await rpc.login().catch((err) => {
      console.log("Discord RPC Login failed:", err.message);
      rpcReady = false;
    });

    // Heartbeat: Reconnect every 10 seconds if not connected
    if (rpcHeartbeatInterval) clearInterval(rpcHeartbeatInterval);
    rpcHeartbeatInterval = setInterval(async () => {
      if (!rpcReady) {
        console.log("Discord RPC Heartbeat: Attempting reconnection...");
        try {
          // Destroy old instance and create new one
          if (rpc) {
            try { await rpc.destroy(); } catch (_) { }
          }

          const rpcModule = await import("@xhayper/discord-rpc");
          const { Client } = rpcModule;
          ActivityType = rpcModule.ActivityType;
          StatusDisplayType = rpcModule.StatusDisplayType;
          rpc = new Client({
            clientId: DISCORD_CLIENT_ID,
          });

          rpc.on("ready", () => {
            console.log("Discord RPC Reconnected!");
            rpcReady = true;
            if (lastPresence) {
              updateDiscordPresence(lastPresence);
            }
          });

          rpc.on("disconnected", () => {
            rpcReady = false;
          });

          await rpc.login();
        } catch (e) {
          console.log("Discord RPC Reconnect failed:", e.message);
        }
      }
      // When connected, do nothing - let the activity continue without reset
    }, 10000); // Check every 10 seconds

  } catch (err) {
    console.error("Discord RPC initialization error:", err);
  }
}

// Update Discord Rich Presence (Spotify-like style)
// Cache for cover art to avoid redundant API calls
// Cover Art Caching System
const COVERS_DIR = path.join(app.getPath("userData"), "covers");
const COVER_LOOKUP_CACHE_PATH = path.join(app.getPath("userData"), "cover-lookup-cache.json");
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// Helper: Generate unique hash for cover file based on path + mtime
function getCoverHash(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const data = `${filePath}-${stats.mtimeMs}`;
    return crypto.createHash("md5").update(data).digest("hex");
  } catch (e) {
    return null;
  }
}

// Cache for cover art to avoid redundant API calls (Runtime memory cache for Discord cover lookups)
const coverCache = new Map();
const coverFetchInFlight = new Map();
const COVER_CACHE_HIT_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const COVER_CACHE_MISS_TTL_MS = 1000 * 60 * 2;
const YOUTUBE_MUSIC_CONFIG_TTL_MS = 1000 * 60 * 60 * 12;
let coverCachePersistTimer = null;
let youTubeMusicConfig = null;
let youTubeMusicConfigFetchedAt = 0;
let youTubeMusicConfigInFlight = null;

function loadPersistedCoverCache() {
  try {
    if (!fs.existsSync(COVER_LOOKUP_CACHE_PATH)) return;

    const raw = JSON.parse(fs.readFileSync(COVER_LOOKUP_CACHE_PATH, "utf8"));
    const now = Date.now();

    for (const [key, entry] of Object.entries(raw)) {
      if (!entry || typeof entry.url !== "string" || typeof entry.expiresAt !== "number") {
        continue;
      }

      if (entry.expiresAt > now) {
        coverCache.set(key, entry);
      }
    }
  } catch (error) {
    console.error("Failed to load cover cache:", error);
  }
}

function persistCoverCache() {
  try {
    const serializable = {};

    for (const [key, entry] of coverCache.entries()) {
      if (!entry?.url || entry.expiresAt <= Date.now()) continue;
      serializable[key] = entry;
    }

    fs.writeFileSync(COVER_LOOKUP_CACHE_PATH, JSON.stringify(serializable, null, 2));
  } catch (error) {
    console.error("Failed to persist cover cache:", error);
  }
}

function schedulePersistCoverCache() {
  if (coverCachePersistTimer) return;

  coverCachePersistTimer = setTimeout(() => {
    coverCachePersistTimer = null;
    persistCoverCache();
  }, 500);
}

loadPersistedCoverCache();

function normalizeCoverQueryPart(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCoverLookupKey(title, artist, album) {
  return [
    normalizeCoverQueryPart(artist),
    normalizeCoverQueryPart(album),
    normalizeCoverQueryPart(title),
  ].join("|");
}

function getCachedCover(key) {
  const entry = coverCache.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    coverCache.delete(key);
    return undefined;
  }

  if (typeof entry.url === "string" && entry.url) {
    const normalizedUrl = normalizeCoverSourceUrl(entry.url) || entry.url;
    if (normalizedUrl !== entry.url) {
      entry.url = normalizedUrl;
      schedulePersistCoverCache();
    }
  }

  return entry.url;
}

function setCachedCover(key, url, isMiss = false) {
  const normalizedRawUrl =
    !isMiss && typeof url === "string" && url
      ? normalizeCoverSourceUrl(url)
      : url;

  const normalizedUrl =
    !isMiss ? normalizedRawUrl : url;

  coverCache.set(key, {
    url: normalizedUrl,
    expiresAt: Date.now() + (isMiss ? COVER_CACHE_MISS_TTL_MS : COVER_CACHE_HIT_TTL_MS),
  });

  if (coverCache.size > 100) {
    const firstKey = coverCache.keys().next().value;
    coverCache.delete(firstKey);
  }

  if (!isMiss && typeof normalizedUrl === "string" && normalizedUrl) {
    schedulePersistCoverCache();
  }
}

function stripCoverSearchNoise(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, " ")
    .replace(/\b(feat\.?|ft\.?|with)\b.*$/i, " ")
    .replace(/\s*[-:]\s*(single|ep|album|deluxe edition|special edition|collector'?s edition|remaster(?:ed)?|version|mono|stereo|explicit|clean)\b.*$/i, " ")
    .replace(/[\/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCoverLookupValue(value) {
  return stripCoverSearchNoise(value)
    .replace(/["\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDeezerSearchAttempts(title, artist, album) {
  const cleanArtist = sanitizeCoverLookupValue(artist);
  const cleanTitle = sanitizeCoverLookupValue(title);
  const cleanAlbum = sanitizeCoverLookupValue(album);
  const releaseName = cleanAlbum && cleanAlbum !== "unknown album" ? cleanAlbum : "";
  const attempts = [
    cleanArtist && cleanTitle
      ? { mode: "track", query: `artist:"${cleanArtist}" track:"${cleanTitle}"` }
      : null,
    cleanArtist && releaseName
      ? { mode: "album", query: `artist:"${cleanArtist}" album:"${releaseName}"` }
      : null,
    cleanArtist && cleanTitle
      ? { mode: "track", query: `${cleanArtist} ${cleanTitle}` }
      : null,
    cleanArtist && releaseName
      ? { mode: "album", query: `${cleanArtist} ${releaseName}` }
      : null,
    cleanTitle ? { mode: "track", query: cleanTitle } : null,
    releaseName ? { mode: "album", query: releaseName } : null,
  ].filter(Boolean);

  return attempts.filter(
    (attempt, index, arr) =>
      arr.findIndex(
        (candidate) => candidate.mode === attempt.mode && candidate.query === attempt.query
      ) === index
  );
}

function buildITunesSearchAttempts(title, artist, album) {
  const cleanArtist = sanitizeCoverLookupValue(artist);
  const cleanTitle = sanitizeCoverLookupValue(title);
  const cleanAlbum = sanitizeCoverLookupValue(album);
  const releaseName = cleanAlbum && cleanAlbum !== "unknown album" ? cleanAlbum : "";
  const attempts = [
    cleanArtist && cleanTitle
      ? { entity: "song", mode: "track", query: `${cleanArtist} ${cleanTitle}` }
      : null,
    cleanArtist && releaseName
      ? { entity: "album", mode: "album", query: `${cleanArtist} ${releaseName}` }
      : null,
    cleanTitle ? { entity: "song", mode: "track", query: cleanTitle } : null,
    releaseName ? { entity: "album", mode: "album", query: releaseName } : null,
  ].filter(Boolean);

  return attempts.filter(
    (attempt, index, arr) =>
      arr.findIndex(
        (candidate) =>
          candidate.entity === attempt.entity &&
          candidate.mode === attempt.mode &&
          candidate.query === attempt.query
      ) === index
  );
}

function buildYouTubeMusicSearchAttempts(title, artist, album) {
  const cleanArtist = sanitizeCoverLookupValue(artist);
  const cleanTitle = sanitizeCoverLookupValue(title);
  const cleanAlbum = sanitizeCoverLookupValue(album);
  const releaseName = cleanAlbum && cleanAlbum !== "unknown album" ? cleanAlbum : "";
  const attempts = [
    cleanArtist && cleanTitle
      ? { mode: "track", query: `${cleanArtist} ${cleanTitle}` }
      : null,
    cleanArtist && releaseName
      ? { mode: "album", query: `${cleanArtist} ${releaseName}` }
      : null,
    cleanTitle ? { mode: "track", query: cleanTitle } : null,
    releaseName ? { mode: "album", query: releaseName } : null,
  ].filter(Boolean);

  return attempts.filter(
    (attempt, index, arr) =>
      arr.findIndex(
        (candidate) => candidate.mode === attempt.mode && candidate.query === attempt.query
      ) === index
  );
}

function normalizeComparable(value) {
  return normalizeCoverQueryPart(stripCoverSearchNoise(value));
}

function normalizeLyricsComparable(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .replace(/\b(?:feat|ft|featuring|official|audio|video|lyrics|mv|version)\b/gi, " ")
    .replace(/[()[\]{}'"`~!@#$%^&*_+=|\\:;,.<>/?-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLatinTokens(value) {
  return normalizeLyricsComparable(value)
    .split(/\s+/)
    .filter((token) => /^[a-z0-9]+$/.test(token) && token.length >= 2);
}

function getNonLatinCompact(value) {
  return normalizeLyricsComparable(value)
    .replace(/[a-z0-9\s]/g, "")
    .replace(/\s+/g, "");
}

function stripJapaneseDecorations(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s*[-–—:：]\s*[A-Za-z0-9][A-Za-z0-9\s'’!?.,-]*$/g, "")
    .replace(/\s*\([^)]*[A-Za-z][^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getYouTubeMusicArtistAliases(artist) {
  const normalized = normalizeLyricsComparable(artist).replace(/\s+/g, "");
  const aliases = [];

  if (normalized.includes("hinatazaka46")) aliases.push("日向坂46");
  if (normalized.includes("sakurazaka46")) aliases.push("櫻坂46", "欅坂46");
  if (normalized.includes("keyakizaka46")) aliases.push("欅坂46");
  if (normalized.includes("nogizaka46")) aliases.push("乃木坂46");

  return aliases.filter((alias, index) => aliases.indexOf(alias) === index);
}

function buildYouTubeMusicLyricsQueries(title, artist, album = "") {
  const rawTitle = String(title || "").trim();
  const rawArtist = String(artist || "").trim();
  const rawAlbum = String(album || "").trim();
  const artistAliases = getYouTubeMusicArtistAliases(rawArtist);
  const japaneseTitle = stripJapaneseDecorations(rawTitle);
  const titleTokens = getLatinTokens(rawTitle);
  const hasNonLatinTitle = !!getNonLatinCompact(rawTitle);
  const compactTitle = normalizeLyricsComparable(rawTitle).replace(/\s+/g, "");
  const queries = [
    rawArtist && rawTitle ? `${rawArtist} ${rawTitle}` : rawTitle,
    rawArtist && rawAlbum && rawTitle ? `${rawArtist} ${rawAlbum} ${rawTitle}` : "",
    rawAlbum && rawTitle ? `${rawAlbum} ${rawTitle}` : "",
    ...artistAliases.flatMap((alias) => [
      rawTitle ? `${alias} ${rawTitle}` : "",
      rawAlbum && rawTitle ? `${alias} ${rawAlbum} ${rawTitle}` : "",
      japaneseTitle && japaneseTitle !== rawTitle ? `${alias} ${japaneseTitle}` : "",
    ]),
    rawArtist && japaneseTitle && japaneseTitle !== rawTitle ? `${rawArtist} ${japaneseTitle}` : "",
    rawArtist && titleTokens.length ? `${rawArtist} ${titleTokens.join(" ")}` : "",
    rawArtist && compactTitle && compactTitle !== normalizeLyricsComparable(rawTitle) ? `${rawArtist} ${compactTitle}` : "",
    rawArtist && hasNonLatinTitle ? rawArtist : "",
    rawTitle,
    japaneseTitle !== rawTitle ? japaneseTitle : "",
  ];

  return queries
    .map((query) => query.trim())
    .filter(Boolean)
    .filter((query, index, list) => list.indexOf(query) === index);
}

function textMatchesLoosely(wanted, candidate) {
  const wantedNorm = normalizeLyricsComparable(wanted);
  const candidateNorm = normalizeLyricsComparable(candidate);
  if (!wantedNorm || !candidateNorm) return true;

  const wantedNonLatin = getNonLatinCompact(wanted);
  const candidateNonLatin = getNonLatinCompact(candidate);
  if (wantedNonLatin && candidateNonLatin) {
    return candidateNonLatin.includes(wantedNonLatin) ||
      wantedNonLatin.includes(candidateNonLatin);
  }

  if (
    candidateNorm.includes(wantedNorm) ||
    wantedNorm.includes(candidateNorm) ||
    candidateNorm.replace(/\s+/g, "").includes(wantedNorm.replace(/\s+/g, "")) ||
    wantedNorm.replace(/\s+/g, "").includes(candidateNorm.replace(/\s+/g, ""))
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

function isLikelyDeezerMatch(result, title, artist, album, mode) {
  const wantedArtist = normalizeComparable(artist);
  const wantedTitle = normalizeComparable(title);
  const wantedAlbum = normalizeComparable(album === "Unknown Album" ? "" : album);
  const resultArtist = normalizeComparable(result?.artist?.name);
  const resultTitle = normalizeComparable(result?.title);
  const resultAlbum = normalizeComparable(result?.album?.title);

  const artistMatches =
    !wantedArtist ||
    resultArtist.includes(wantedArtist) ||
    wantedArtist.includes(resultArtist);

  if (!artistMatches) return false;

  if (mode === "album") {
    return !!wantedAlbum && !!resultAlbum &&
      (resultAlbum.includes(wantedAlbum) || wantedAlbum.includes(resultAlbum));
  }

  if (!wantedTitle || !resultTitle) return artistMatches;
  return resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle);
}

async function searchDeezer(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": COVER_LOOKUP_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Deezer search failed: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function searchITunes(query, entity) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const params = new URLSearchParams({
      term: query,
      media: "music",
      entity,
      limit: "5",
    });
    const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": COVER_LOOKUP_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`iTunes search failed: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function getYouTubeMusicConfig(forceRefresh = false) {
  const isFresh =
    !forceRefresh &&
    youTubeMusicConfig &&
    Date.now() - youTubeMusicConfigFetchedAt < YOUTUBE_MUSIC_CONFIG_TTL_MS;

  if (isFresh) {
    return youTubeMusicConfig;
  }

  if (!forceRefresh && youTubeMusicConfigInFlight) {
    return youTubeMusicConfigInFlight;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch("https://music.youtube.com/", {
        signal: controller.signal,
        headers: YOUTUBE_MUSIC_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`YouTube Music bootstrap failed: ${response.status}`);
      }

      const html = await response.text();
      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      const contextMatch = html.match(/"INNERTUBE_CONTEXT":(\{.*?\}),"INNERTUBE_CONTEXT_CLIENT_NAME"/s);

      if (!apiKeyMatch || !contextMatch) {
        throw new Error("YouTube Music bootstrap payload missing API config");
      }

      youTubeMusicConfig = {
        apiKey: apiKeyMatch[1],
        context: JSON.parse(contextMatch[1]),
      };
      youTubeMusicConfigFetchedAt = Date.now();
      return youTubeMusicConfig;
    } finally {
      clearTimeout(timeout);
    }
  })();

  youTubeMusicConfigInFlight = request;

  try {
    return await request;
  } finally {
    if (youTubeMusicConfigInFlight === request) {
      youTubeMusicConfigInFlight = null;
    }
  }
}

function getRunsText(runs) {
  return Array.isArray(runs)
    ? runs.map((run) => run?.text || "").join("").trim()
    : "";
}

function getYouTubeMusicTextSegments(runs) {
  return getRunsText(runs)
    .split(/\s*(?:\u2022|\u00b7)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getYouTubeMusicThumbnailUrl(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) {
    return null;
  }

  const bestThumbnail = thumbnails.reduce((best, current) => {
    const bestScore = (best?.width || 0) * (best?.height || 0);
    const currentScore = (current?.width || 0) * (current?.height || 0);
    return currentScore >= bestScore ? current : best;
  }, null);

  return normalizeCoverSourceUrl(bestThumbnail?.url) || bestThumbnail?.url || null;
}

function buildYouTubeMusicCardCandidate(renderer) {
  const title = getRunsText(renderer?.title?.runs);
  const subtitleSegments = getYouTubeMusicTextSegments(renderer?.subtitle?.runs);
  const type = normalizeCoverQueryPart(subtitleSegments[0]);
  const artist = subtitleSegments[1] || "";
  const thumbnailUrl = getYouTubeMusicThumbnailUrl(
    renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
  );

  if (!title || !thumbnailUrl || (type !== "album" && type !== "song")) {
    return null;
  }

  return {
    type,
    title: type === "song" ? title : "",
    album: type === "album" ? title : "",
    artist,
    thumbnailUrl,
  };
}

function buildYouTubeMusicItemCandidate(renderer) {
  const title = getRunsText(
    renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  );
  const subtitleSegments = getYouTubeMusicTextSegments(
    renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  );
  const type = normalizeCoverQueryPart(subtitleSegments[0]);
  const artist = subtitleSegments[1] || "";
  const thumbnailUrl = getYouTubeMusicThumbnailUrl(
    renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
  );

  if (!title || !thumbnailUrl || (type !== "album" && type !== "song")) {
    return null;
  }

  return {
    type,
    title: type === "song" ? title : "",
    album: type === "album" ? title : "",
    artist,
    thumbnailUrl,
  };
}

function collectYouTubeMusicCandidates(node, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectYouTubeMusicCandidates(entry, results);
    }
    return results;
  }

  if (node.musicCardShelfRenderer) {
    const candidate = buildYouTubeMusicCardCandidate(node.musicCardShelfRenderer);
    if (candidate) {
      results.push(candidate);
    }
  }

  if (node.musicResponsiveListItemRenderer) {
    const candidate = buildYouTubeMusicItemCandidate(node.musicResponsiveListItemRenderer);
    if (candidate) {
      results.push(candidate);
    }
  }

  for (const value of Object.values(node)) {
    collectYouTubeMusicCandidates(value, results);
  }

  return results;
}

async function searchYouTubeMusic(query, forceRefresh = false) {
  const config = await getYouTubeMusicConfig(forceRefresh);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const context = JSON.parse(JSON.stringify(config.context));
    if (context?.client) {
      context.client.originalUrl = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
    }

    const response = await fetch(
      `https://music.youtube.com/youtubei/v1/search?prettyPrint=false&key=${config.apiKey}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          ...YOUTUBE_MUSIC_HEADERS,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Origin": "https://music.youtube.com",
          "Referer": `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
        },
        body: JSON.stringify({
          context,
          query,
        }),
      }
    );

    if (!response.ok) {
      if (!forceRefresh) {
        return searchYouTubeMusic(query, true);
      }

      throw new Error(`YouTube Music search failed: ${response.status}`);
    }

    const data = await response.json();
    return collectYouTubeMusicCandidates(data);
  } finally {
    clearTimeout(timeout);
  }
}

function getYouTubeMusicRendererVideoId(renderer) {
  return (
    renderer?.playlistItemData?.videoId ||
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
      ?.runs?.find((run) => run?.navigationEndpoint?.watchEndpoint?.videoId)
      ?.navigationEndpoint?.watchEndpoint?.videoId ||
    null
  );
}

function buildYouTubeMusicSongCandidate(renderer) {
  const title = getRunsText(
    renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  );
  const subtitleSegments = getYouTubeMusicTextSegments(
    renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  );
  const type = normalizeCoverQueryPart(subtitleSegments[0]);
  const artist = subtitleSegments[1] || "";
  const album = type === "song" ? subtitleSegments[2] || "" : "";
  const videoId = getYouTubeMusicRendererVideoId(renderer);

  if (!title || !videoId || (type !== "song" && type !== "video")) {
    return null;
  }

  return { type, title, artist, album, videoId };
}

function collectYouTubeMusicSongCandidates(node, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectYouTubeMusicSongCandidates(entry, results);
    }
    return results;
  }

  if (node.musicResponsiveListItemRenderer) {
    const candidate = buildYouTubeMusicSongCandidate(node.musicResponsiveListItemRenderer);
    if (
      candidate &&
      !results.some((result) => result.videoId === candidate.videoId)
    ) {
      results.push(candidate);
    }
  }

  for (const value of Object.values(node)) {
    collectYouTubeMusicSongCandidates(value, results);
  }

  return results;
}

async function searchYouTubeMusicSongs(query, forceRefresh = false) {
  const config = await getYouTubeMusicConfig(forceRefresh);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const context = JSON.parse(JSON.stringify(config.context));
    if (context?.client) {
      context.client.originalUrl = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
    }

    const response = await fetch(
      `https://music.youtube.com/youtubei/v1/search?prettyPrint=false&key=${config.apiKey}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          ...YOUTUBE_MUSIC_HEADERS,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Origin": "https://music.youtube.com",
          "Referer": `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
        },
        body: JSON.stringify({ context, query }),
      }
    );

    if (!response.ok) {
      if (!forceRefresh) {
        return searchYouTubeMusicSongs(query, true);
      }

      throw new Error(`YouTube Music song search failed: ${response.status}`);
    }

    return collectYouTubeMusicSongCandidates(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function isLikelyYouTubeMusicSongMatch(result, title, artist) {
  const wantedArtist = normalizeLyricsComparable(artist);
  const artistIsUnknown =
    !wantedArtist ||
    wantedArtist === "unknown artist" ||
    wantedArtist === "unknown";

  return (
    textMatchesLoosely(title, result?.title) &&
    (artistIsUnknown || textMatchesLoosely(artist, result?.artist))
  );
}

function scoreYouTubeMusicSongCandidate(result, title, artist, album = "") {
  const wantedTitle = normalizeLyricsComparable(title);
  const resultTitle = normalizeLyricsComparable(result?.title);
  const wantedAlbum = normalizeLyricsComparable(album);
  const resultAlbum = normalizeLyricsComparable(result?.album);
  const titleCompact = wantedTitle.replace(/\s+/g, "");
  const resultCompact = resultTitle.replace(/\s+/g, "");
  let score = 0;

  if (result?.type === "song") score += 50;
  if (result?.type === "video") score += 10;
  if (wantedTitle && resultTitle === wantedTitle) score += 80;
  else if (titleCompact && resultCompact === titleCompact) score += 70;
  else if (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)) score += 35;
  if (
    /\b(?:off\s*vocal|instrumental|karaoke)\b/.test(resultTitle) &&
    !/\b(?:off\s*vocal|instrumental|karaoke)\b/.test(wantedTitle)
  ) {
    score -= 45;
  }

  if (textMatchesLoosely(artist, result?.artist)) score += 30;
  if (
    wantedAlbum &&
    resultAlbum &&
    (resultAlbum.includes(wantedAlbum) || wantedAlbum.includes(resultAlbum))
  ) {
    score += 25;
  }

  return score;
}

function collectYouTubeMusicBrowseEndpoints(node, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectYouTubeMusicBrowseEndpoints(entry, results);
    }
    return results;
  }

  if (node.browseEndpoint?.browseId) {
    results.push(node.browseEndpoint);
  }

  for (const value of Object.values(node)) {
    collectYouTubeMusicBrowseEndpoints(value, results);
  }

  return results;
}

function collectYouTubeMusicLyricsTexts(node, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectYouTubeMusicLyricsTexts(entry, results);
    }
    return results;
  }

  const description = getRunsText(node.musicDescriptionShelfRenderer?.description?.runs);
  if (description) {
    results.push(description);
  }

  for (const value of Object.values(node)) {
    collectYouTubeMusicLyricsTexts(value, results);
  }

  return results;
}

function collectYouTubeMusicTimedLyrics(node, results = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    if (
      node.some((entry) =>
        entry &&
        typeof entry === "object" &&
        (entry.lyricLine || entry.text || entry.line) &&
        (entry.cueRange || entry.startTimeMilliseconds || entry.startTimeMs || entry.startTimeSeconds)
      )
    ) {
      results.push(node);
    }

    for (const entry of node) {
      collectYouTubeMusicTimedLyrics(entry, results);
    }
    return results;
  }

  const timedData =
    node.timedLyricsModel?.lyricsData?.timedLyricsData ||
    node.lyricsData?.timedLyricsData ||
    node.timedLyricsData;
  if (Array.isArray(timedData)) {
    results.push(timedData);
  }

  for (const value of Object.values(node)) {
    collectYouTubeMusicTimedLyrics(value, results);
  }

  return results;
}

function parseYouTubeMusicTimeSeconds(value, unit = "seconds") {
  if (value === null || value === undefined) return null;

  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return unit === "milliseconds" ? numeric / 1000 : numeric;
}

function parseYouTubeMusicTimedLyrics(timedData) {
  if (!Array.isArray(timedData)) return [];

  return timedData
    .map((entry) => {
      const text = String(
        entry?.lyricLine ||
        entry?.line ||
        entry?.text?.runs?.map((run) => run?.text || "").join("") ||
        entry?.text ||
        ""
      ).trim();
      const time =
        parseYouTubeMusicTimeSeconds(entry?.cueRange?.startTimeMilliseconds, "milliseconds") ??
        parseYouTubeMusicTimeSeconds(entry?.startTimeMilliseconds, "milliseconds") ??
        parseYouTubeMusicTimeSeconds(entry?.startTimeMs, "milliseconds") ??
        parseYouTubeMusicTimeSeconds(entry?.cueRange?.startTimeSeconds) ??
        parseYouTubeMusicTimeSeconds(entry?.startTimeSeconds) ??
        parseYouTubeMusicTimeSeconds(entry?.startTime);
      if (!text || time === null) return null;

      return {
        time,
        text,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);
}

async function fetchYouTubeMusicLyricsForVideo(videoId, forceRefresh = false) {
  const config = await getYouTubeMusicConfig(forceRefresh);
  const context = JSON.parse(JSON.stringify(config.context));
  if (context?.client) {
    context.client.originalUrl = `https://music.youtube.com/watch?v=${videoId}`;
  }

  const nextController = new AbortController();
  const nextTimeout = setTimeout(() => nextController.abort(), 8000);

  try {
    const nextResponse = await fetch(
      `https://music.youtube.com/youtubei/v1/next?prettyPrint=false&key=${config.apiKey}`,
      {
        method: "POST",
        signal: nextController.signal,
        headers: {
          ...YOUTUBE_MUSIC_HEADERS,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Origin": "https://music.youtube.com",
          "Referer": `https://music.youtube.com/watch?v=${videoId}`,
        },
        body: JSON.stringify({ context, videoId }),
      }
    );

    if (!nextResponse.ok) {
      if (!forceRefresh) {
        return fetchYouTubeMusicLyricsForVideo(videoId, true);
      }

      throw new Error(`YouTube Music next failed: ${nextResponse.status}`);
    }

    const lyricsEndpoint = collectYouTubeMusicBrowseEndpoints(await nextResponse.json())
      .find((endpoint) => String(endpoint.browseId || "").startsWith("MPLY"));

    if (!lyricsEndpoint?.browseId) {
      return null;
    }

    const browseController = new AbortController();
    const browseTimeout = setTimeout(() => browseController.abort(), 8000);

    try {
      const timedClientOverrides = [
        { clientName: "ANDROID_MUSIC", clientVersion: "7.21.50" },
        { clientName: "IOS_MUSIC", clientVersion: "7.21.50" },
      ];

      for (const clientOverride of timedClientOverrides) {
        try {
          const mobileContext = JSON.parse(JSON.stringify(config.context));
          if (mobileContext?.client) {
            Object.assign(mobileContext.client, clientOverride);
            mobileContext.client.originalUrl = `https://music.youtube.com/watch?v=${videoId}`;
          }

          const timedResponse = await fetch(
            `https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&key=${config.apiKey}`,
            {
              method: "POST",
              signal: browseController.signal,
              headers: {
                ...YOUTUBE_MUSIC_HEADERS,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": "https://music.youtube.com",
                "Referer": `https://music.youtube.com/watch?v=${videoId}`,
              },
              body: JSON.stringify({
                context: mobileContext,
                browseId: lyricsEndpoint.browseId,
                params: lyricsEndpoint.params,
              }),
            }
          );

          if (timedResponse.ok) {
            const timedLyrics = collectYouTubeMusicTimedLyrics(await timedResponse.json())
              .map(parseYouTubeMusicTimedLyrics)
              .find((lyrics) => lyrics.length > 0);

            if (timedLyrics?.length) {
              return {
                lyrics: timedLyrics.map((line) => line.text).join("\n"),
                synced: timedLyrics,
              };
            }
          }
        } catch (error) {
          console.warn(
            `YouTube Music timed lyrics failed (${clientOverride.clientName}):`,
            error?.message || error
          );
        }
      }

      const plainResponse = await fetch(
        `https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&key=${config.apiKey}`,
        {
          method: "POST",
          signal: browseController.signal,
          headers: {
            ...YOUTUBE_MUSIC_HEADERS,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://music.youtube.com",
            "Referer": `https://music.youtube.com/watch?v=${videoId}`,
          },
          body: JSON.stringify({
            context,
            browseId: lyricsEndpoint.browseId,
            params: lyricsEndpoint.params,
          }),
        }
      );

      if (!plainResponse.ok) {
        throw new Error(`YouTube Music lyrics browse failed: ${plainResponse.status}`);
      }

      const lyrics = collectYouTubeMusicLyricsTexts(await plainResponse.json())
        .sort((a, b) => b.length - a.length)[0];

      return lyrics ? { lyrics } : null;
    } finally {
      clearTimeout(browseTimeout);
    }
  } finally {
    clearTimeout(nextTimeout);
  }
}

async function fetchLyricsFromYouTubeMusic(title, artist, album = "") {
  const attempts = buildYouTubeMusicLyricsQueries(title, artist, album);
  let plainFallback = null;

  for (const query of attempts) {
    try {
      const candidates = await searchYouTubeMusicSongs(query);
      const matchedCandidates = candidates
        .filter((candidate) => isLikelyYouTubeMusicSongMatch(candidate, title, artist))
        .sort(
          (a, b) =>
            scoreYouTubeMusicSongCandidate(b, title, artist, album) -
            scoreYouTubeMusicSongCandidate(a, title, artist, album)
        );

      for (const candidate of matchedCandidates.slice(0, 5)) {
        const lyrics = await fetchYouTubeMusicLyricsForVideo(candidate.videoId);
        if (lyrics) {
          const result = {
            ...lyrics,
            videoId: candidate.videoId,
            title: candidate.title,
            artist: candidate.artist,
          };

          if (Array.isArray(result.synced) && result.synced.length > 0) {
            return result;
          }

          plainFallback ??= result;
        }
      }
    } catch (error) {
      console.warn(`YouTube Music lyrics lookup failed (${query}):`, error?.message || error);
    }
  }

  return plainFallback;
}

function getDeezerCoverUrl(result) {
  return (
    result?.album?.cover_xl ||
    result?.album?.cover_big ||
    result?.album?.cover_medium ||
    result?.album?.cover ||
    null
  );
}

function getITunesCoverUrl(result) {
  const artworkUrl =
    result?.artworkUrl100 ||
    result?.artworkUrl60 ||
    null;

  if (!artworkUrl || typeof artworkUrl !== "string") {
    return null;
  }

  return artworkUrl.replace(/(\d+)x(\d+)bb(?=[-/.])/i, "600x600bb");
}

function normalizeCoverSourceUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    let current = url;

    for (let i = 0; i < 3; i++) {
      const parsed = new URL(current);
      if (parsed.hostname !== "wsrv.nl") {
        return current;
      }

      const nested = parsed.searchParams.get("url");
      if (!nested || !/^https?:\/\//i.test(nested)) {
        return current;
      }

      current = nested;
    }

    return current;
  } catch {
    return url;
  }
}

function isLikelyITunesMatch(result, title, artist, album, mode) {
  const wantedArtist = normalizeComparable(artist);
  const wantedTitle = normalizeComparable(title);
  const wantedAlbum = normalizeComparable(album === "Unknown Album" ? "" : album);
  const resultArtist = normalizeComparable(result?.artistName);
  const resultTitle = normalizeComparable(
    result?.trackName || result?.trackCensoredName || result?.collectionName
  );
  const resultAlbum = normalizeComparable(result?.collectionName);

  const artistMatches =
    !wantedArtist ||
    resultArtist.includes(wantedArtist) ||
    wantedArtist.includes(resultArtist);

  if (!artistMatches) return false;

  if (mode === "album") {
    return !!wantedAlbum && !!resultAlbum &&
      (resultAlbum.includes(wantedAlbum) || wantedAlbum.includes(resultAlbum));
  }

  if (!wantedTitle || !resultTitle) return artistMatches;
  return resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle);
}

function isLikelyYouTubeMusicMatch(result, title, artist, album, mode) {
  const wantedArtist = normalizeComparable(artist);
  const wantedTitle = normalizeComparable(title);
  const wantedAlbum = normalizeComparable(album === "Unknown Album" ? "" : album);
  const resultArtist = normalizeComparable(result?.artist);
  const resultTitle = normalizeComparable(result?.title);
  const resultAlbum = normalizeComparable(result?.album);

  const artistMatches =
    !wantedArtist ||
    resultArtist.includes(wantedArtist) ||
    wantedArtist.includes(resultArtist);

  if (!artistMatches) return false;

  if (mode === "album") {
    return result?.type === "album" && !!wantedAlbum && !!resultAlbum &&
      (resultAlbum.includes(wantedAlbum) || wantedAlbum.includes(resultAlbum));
  }

  return result?.type === "song" &&
    !!wantedTitle &&
    !!resultTitle &&
    (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle));
}

async function fetchCoverArtFromITunes(title, artist, album) {
  const attempts = buildITunesSearchAttempts(title, artist, album);

  for (const attempt of attempts) {
    if (!attempt.query) continue;

    try {
      const results = await searchITunes(attempt.query, attempt.entity);
      for (const result of results) {
        if (!isLikelyITunesMatch(result, title, artist, album, attempt.mode)) {
          continue;
        }

        const url = getITunesCoverUrl(result);
        if (url) {
          return url;
        }
      }
    } catch (error) {
      console.error(`Cover Fetch Error (iTunes ${attempt.entity}: ${attempt.query}):`, error.message);
    }
  }

  return null;
}

async function fetchCoverArtFromYouTubeMusic(title, artist, album) {
  const attempts = buildYouTubeMusicSearchAttempts(title, artist, album);

  for (const attempt of attempts) {
    if (!attempt.query) continue;

    try {
      const results = await searchYouTubeMusic(attempt.query);
      for (const result of results.slice(0, 12)) {
        if (!isLikelyYouTubeMusicMatch(result, title, artist, album, attempt.mode)) {
          continue;
        }

        if (result.thumbnailUrl) {
          return result.thumbnailUrl;
        }
      }
    } catch (error) {
      console.error(`Cover Fetch Error (YouTube Music ${attempt.mode}: ${attempt.query}):`, error.message);
    }
  }

  return null;
}

async function fetchCoverArtFromDeezer(title, artist, album) {
  const attempts = buildDeezerSearchAttempts(title, artist, album);

  for (const attempt of attempts) {
    if (!attempt.query) continue;

    try {
      const results = await searchDeezer(attempt.query);
      for (const result of results.slice(0, 3)) {
        if (!isLikelyDeezerMatch(result, title, artist, album, attempt.mode)) {
          continue;
        }

        const url = getDeezerCoverUrl(result);
        if (url) {
          return url;
        }
      }
    } catch (error) {
      console.error(`Cover Fetch Error (${attempt.mode}: ${attempt.query}):`, error.message);
    }
  }

  return null;
}

// Helper: Fetch cover art from Apple/iTunes first, then YouTube Music, then Deezer.
async function fetchCoverArt(title, artist, album) {
  const key = getCoverLookupKey(title, artist, album);
  const cachedUrl = getCachedCover(key);
  if (cachedUrl !== undefined) return cachedUrl;

  if (coverFetchInFlight.has(key)) {
    return coverFetchInFlight.get(key);
  }

  const request = (async () => {
    try {
      const providers = [
        () => fetchCoverArtFromITunes(title, artist, album),
        () => fetchCoverArtFromYouTubeMusic(title, artist, album),
        () => fetchCoverArtFromDeezer(title, artist, album),
      ];

      for (const resolveCover of providers) {
        const url = await resolveCover();
        if (url) {
          setCachedCover(key, url, false);
          return url;
        }
      }
    } catch (e) {
      console.error("Cover Fetch Error:", e);
    }

    setCachedCover(key, null, true);
    return null;
  })();

  coverFetchInFlight.set(key, request);

  try {
    return await request;
  } finally {
    coverFetchInFlight.delete(key);
  }
}

function rememberResolvedCover(coverLookupKey, imageKey) {
  if (!imageKey || imageKey === "lumina_icon") return;
  lastCoverLookupKey = coverLookupKey;
  lastCoverUrl = imageKey;
}

function getImmediateCoverImage(data, coverLookupKey) {
  const cachedCover = getCachedCover(coverLookupKey);
  if (typeof cachedCover === "string" && cachedCover) {
    return cachedCover;
  }

  const directCover = normalizeCoverSourceUrl(data.cover);
  if (directCover) {
    return directCover;
  }

  if (lastCoverLookupKey === coverLookupKey && lastCoverUrl) {
    return lastCoverUrl;
  }

  return "lumina_icon";
}

function buildDiscordActivity(data, largeImageKey) {
  const artist = data.artist || "Unknown Artist";
  const title = data.title || "Unknown Track";
  const album = data.album || "Lumina Music Player";
  const isPlaying = !!data.isPlaying;
  const hasValidTimeline =
    isPlaying &&
    Number.isFinite(data.currentTime) &&
    Number.isFinite(data.duration) &&
    data.duration > 0 &&
    data.currentTime >= 0 &&
    data.currentTime < data.duration;

  const activity = {
    name: isPlaying ? "Lumina Music" : "Lumina Music Player",
    type: isPlaying ? (ActivityType?.Listening ?? 2) : (ActivityType?.Playing ?? 0),
    details: title,
    state: isPlaying ? artist : `Paused - ${artist}`,
    statusDisplayType: StatusDisplayType?.STATE ?? 1,
    largeImageKey,
    largeImageText: album,
    instance: false,
  };

  if (!isPlaying) {
    activity.smallImageKey = "paused";
    activity.smallImageText = "Paused";
  }

  if (hasValidTimeline) {
    const remaining = data.duration - data.currentTime;
    if (remaining > 0) {
      activity.startTimestamp = Date.now() - data.currentTime * 1000;
      activity.endTimestamp = Date.now() + remaining * 1000;
    }
  }

  return activity;
}

async function applyDiscordActivity(data, largeImageKey) {
  if (!rpc || !rpcReady) return;
  await rpc.user?.setActivity(buildDiscordActivity(data, largeImageKey));
}

function refreshDiscordCoverInBackground(data, coverLookupKey) {
  const artist = data.artist || "Unknown Artist";
  const title = data.title || "Unknown Track";
  const album = data.album || "Lumina Music Player";
  const cachedCover = getCachedCover(coverLookupKey);

  if (!title || artist === "Unknown Artist" || cachedCover !== undefined) {
    return;
  }

  void (async () => {
    try {
      const fetchedUrl = await fetchCoverArt(title, artist, album);
      if (!fetchedUrl || !rpc || !rpcReady || !lastPresence) return;

      const latestCoverLookupKey = getCoverLookupKey(
        lastPresence.title || "",
        lastPresence.artist || "",
        lastPresence.album || ""
      );

      if (latestCoverLookupKey !== coverLookupKey) {
        return;
      }

      const imageKey = normalizeCoverSourceUrl(fetchedUrl) || fetchedUrl;
      rememberResolvedCover(coverLookupKey, imageKey);
      await applyDiscordActivity(lastPresence, imageKey);
    } catch (error) {
      console.error("Error refreshing Discord cover:", error);
    }
  })();
}

// Update Discord Rich Presence (Spotify-like style)
async function updateDiscordPresence(data) {
  if (!rpc || !rpcReady) return;

  try {
    const artist = data.artist || "Unknown Artist";
    const title = data.title || "Unknown Track";
    const album = data.album || "Lumina Music Player";
    const normalizedData = {
      ...data,
      artist,
      title,
      album,
    };

    const coverLookupKey = getCoverLookupKey(title, artist, album);
    const largeImageKey = getImmediateCoverImage(normalizedData, coverLookupKey);

    rememberResolvedCover(coverLookupKey, largeImageKey);
    await applyDiscordActivity(normalizedData, largeImageKey);

    if (largeImageKey === "lumina_icon") {
      refreshDiscordCoverInBackground(normalizedData, coverLookupKey);
    }
  } catch (err) {
    console.error("Error updating Discord presence:", err);
  }
}

// Clear Discord Rich Presence
function clearDiscordPresence() {
  lastPresence = null;
  lastCoverUrl = null;
  lastCoverLookupKey = null;
  if (rpc && rpcReady) {
    try {
      rpc.user?.clearActivity();
    } catch (err) {
      console.error("Error clearing Discord presence:", err);
    }
  }
}

// Store for config (API key + playlist)
const configPath = path.join(app.getPath("userData"), "config.json");

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.error("Error reading config:", e);
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Error saving config:", e);
  }
}

const audioExtensions = [
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".m4a",
  ".aac",
  ".wma",
];

function formatPlaylistName(relativeFolder) {
  if (!relativeFolder || relativeFolder === ".") {
    return "Library Root";
  }

  return relativeFolder
    .split(path.sep)
    .filter(Boolean)
    .join(" / ");
}

function readAudioFilesFromFolder(folderPath) {
  try {
    const audioFiles = [];
    const foldersToScan = [folderPath];

    while (foldersToScan.length > 0) {
      const currentFolder = foldersToScan.pop();
      const entries = fs.readdirSync(currentFolder, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentFolder, entry.name);

        if (entry.isDirectory()) {
          foldersToScan.push(fullPath);
          continue;
        }

        // Avoid following symlinks/junctions and only collect actual audio files.
        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (audioExtensions.includes(ext)) {
          audioFiles.push(fullPath);
        }
      }
    }

    return audioFiles.sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error("Error reading folder:", e);
    return [];
  }
}

function scanMusicFolder(folderPath) {
  return readAudioFilesFromFolder(folderPath).map((filePath) => {
    const relativeFolderPath = path.relative(folderPath, path.dirname(filePath));
    const relativeFolder =
      !relativeFolderPath || relativeFolderPath === "."
        ? undefined
        : relativeFolderPath;

    return {
      path: filePath,
      name: path.basename(filePath),
      relativeFolder,
      playlistName: formatPlaylistName(relativeFolder),
    };
  });
}

let mainWindow;

// Electron performance optimizations for Windows
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

// Fix color rendering to match web browser (prevents washed-out colors in CSS blur)
app.commandLine.appendSwitch('force-color-profile', 'srgb');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#000000",
    icon: APP_ICON_PATH,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      backgroundThrottling: false, // Don't throttle when in background
      enableBlinkFeatures: 'CSSContentVisibilityAutoStateChange',
      zoomFactor: 1.05,
    },
    frame: true,
    titleBarStyle: "default",
    autoHideMenuBar: true, // Hide File/Edit menu
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  initDiscordRPC();
});

app.on("window-all-closed", () => {
  clearDiscordPresence();
  persistCoverCache();

  // Clean up Discord RPC
  if (rpcHeartbeatInterval) clearInterval(rpcHeartbeatInterval);

  if (rpc) {
    try {
      rpc.destroy();
    } catch (_) { }
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handler for Discord Rich Presence
ipcMain.handle("update-discord-presence", (event, data) => {
  lastPresence = data; // Cache for reconnection
  updateDiscordPresence(data);
  return true;
});

ipcMain.handle("preload-discord-cover", async (event, data) => {
  if (!data?.title || !data?.artist || data.artist === "Unknown Artist") {
    return null;
  }

  try {
    return await fetchCoverArt(data.title, data.artist, data.album || "Unknown Album");
  } catch (error) {
    console.error("Error preloading Discord cover:", error);
    return null;
  }
});

ipcMain.handle("clear-discord-presence", () => {
  clearDiscordPresence();
  return true;
});

// IPC handlers for API key management
ipcMain.handle("get-api-key", () => {
  const config = getConfig();
  return config.apiKey || "";
});

ipcMain.handle("set-api-key", (event, apiKey) => {
  const config = getConfig();
  config.apiKey = apiKey;
  saveConfig(config);
  return true;
});

ipcMain.handle("has-api-key", () => {
  const config = getConfig();
  return !!config.apiKey;
});

ipcMain.handle("fetch-youtube-music-lyrics", async (event, { title, artist, album }) => {
  if (!title || !artist) return null;

  try {
    return await fetchLyricsFromYouTubeMusic(title, artist, album || "");
  } catch (error) {
    console.warn("YouTube Music lyrics lookup failed:", error?.message || error);
    return null;
  }
});

// IPC handlers for playlist persistence
ipcMain.handle("save-playlist", (event, items) => {
  const config = getConfig();
  // Ensure we persist objects with metadata.
  // Since cover art is now a file path (or URL), it is safe to persist it directly!
  // No need to strip it excessively, though standard config practice suggests keeping it small.
  // If 'cover' is a local file path, it's small string data.
  const persistedItems = items.map(item => {
    if (typeof item === 'string') return item; // Legacy support

    return {
      path: item.path,
      name: item.name,
      relativeFolder: item.relativeFolder,
      playlistName: item.playlistName,
      metadata: item.metadata // Now includes 'cover' as string string path
    };
  });

  config.playlist = persistedItems;
  saveConfig(config);
  return true;
});

ipcMain.handle("get-playlist", () => {
  const config = getConfig();
  return config.playlist || [];
});

ipcMain.handle("save-current-index", (event, index) => {
  const config = getConfig();
  config.currentSongIndex = index;
  saveConfig(config);
  return true;
});

ipcMain.handle("get-current-index", () => {
  const config = getConfig();
  return config.currentSongIndex ?? -1;
});

// Read file as buffer for audio playback
ipcMain.handle("read-file-buffer", async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".wma": "audio/x-ms-wma",
      };
      const mimeType = mimeTypes[ext] || "audio/mpeg";
      return {
        buffer: buffer.toString("base64"),
        mimeType,
        name: path.basename(filePath),
      };
    }
    return null;
  } catch (e) {
    console.error("Error reading file:", e);
    return null;
  }
});

// Check if file exists
ipcMain.handle("file-exists", async (event, filePath) => {
  return fs.existsSync(filePath);
});

// LDAC IPC Handlers
// LDAC IPC Handlers
// LDAC Module Singleton
let ldacInstance = null;
let LdacEncoderClass = null;

function loadLdacModule() {
  if (LdacEncoderClass) return true;
  try {
    let modulePath = path.join(__dirname, "../native/ldac/ldacJS.js");
    if (__dirname.includes("app.asar")) {
      const unpackedPath = path.join(process.resourcesPath, "app.asar.unpacked/native/ldac/ldacJS.js");
      if (fs.existsSync(unpackedPath)) modulePath = unpackedPath;
      else modulePath = path.join(__dirname, "../native/ldac/ldacJS.js");
    }
    LdacEncoderClass = require(modulePath);
    return !!LdacEncoderClass;
  } catch (e) {
    console.error("LDAC Load Error:", e);
    return false;
  }
}

// Bluetooth State Verification
// Checks if the active playback device is a Bluetooth device
function checkBluetoothActive() {
  return new Promise((resolve) => {
    // PowerShell to find active audio device with 'Bluetooth' in name
    const cmd = `powershell "Get-PnpDevice -Class 'AudioEndpoint' -Status 'OK' | Where-Object { $_.FriendlyName -match 'Bluetooth' -or $_.FriendlyName -match 'WH-1000' -or $_.FriendlyName -match 'WF-1000' }"`;

    // We intentionally invoke the checking command to ensure we are querying the system
    const { exec } = require('child_process');
    exec(cmd, (err, stdout, stderr) => {
      if (stdout && stdout.trim().length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// Initialize LDAC Session for specific song parameters
ipcMain.handle("ldac-init-session", async (event, { sampleRate }) => {
  if (!loadLdacModule()) return false;

  try {
    // Initialize Sony AOSP Codec with HQ settings
    // MTU: 679 (Standard)
    // EQMID: 0 (HQ - 990kbps)
    // Channel Mode: 0x01 (Stereo)
    // Fmt: 0 (PCM)
    // Sample Rate: passed from App (or default 44100)

    console.log(`[LDAC CORE] Initializing Codec for Playback Session: ${sampleRate}Hz`);
    ldacInstance = new LdacEncoderClass(679, 0, 0x01, 0, sampleRate || 44100);

    const bitrate = ldacInstance.getBitrate();
    console.log(`[LDAC CORE] Target Bitrate Calculated: ${bitrate} kbps`);

    return { success: true, bitrate };
  } catch (e) {
    console.error("LDAC Session Init Error:", e);
    return { success: false, bitrate: 0 };
  }
});

ipcMain.handle("ldac-available", async () => {
  console.log("[LDAC CHECK] Starting verification sequence...");

  if (!loadLdacModule()) {
    console.warn("[LDAC CHECK] Failed: ldac.js module not loaded");
    return false;
  }
  // Create a temporary instance for checking capability if not exists
  const instance = new LdacEncoderClass(679, 0, 0x01, 0, 44100);

  // Explicitly use the codec file checks as requested
  if (!instance.constructor.verifySonyAOSPCore()) {
    console.warn("[LDAC CHECK] Failed: Codec Engine verification failed");
    return false;
  }
  console.log("[LDAC CHECK] Step 1: Codec Engine (ldac.js) Verified AOSP Standards.");

  // 2. Check if a Bluetooth Audio Device is actually connected
  // STRICT CHECK: If not Bluetooth, return FALSE immediately.
  // This ensures LDAC is hidden when using Wired/Speakers.
  const isBluetooth = await checkBluetoothActive();

  if (!isBluetooth) {
    console.log("[LDAC CHECK] No Bluetooth Device detected. LDAC Inactive (Wired/Speaker Mode).");
    return false;
  }

  console.log("[LDAC CHECK] Bluetooth Detected & Codec Engine Verified. LDAC Active.");
  return true;
});

ipcMain.handle("ldac-get-bitrate", () => {
  const instance = getLdacInstance();
  if (instance) {
    return instance.getBitrate();
  }
  return 0;
});


// Open folder dialog and return audio file paths
ipcMain.handle("open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Music Folder",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const folderPath = result.filePaths[0];
  const audioFiles = scanMusicFolder(folderPath);

  const config = getConfig();
  config.musicFolderPath = folderPath;
  saveConfig(config);

  return audioFiles;
});

ipcMain.handle("refresh-music-folder", async () => {
  const config = getConfig();
  let folderPath = config.musicFolderPath;

  if (!folderPath && Array.isArray(config.playlist) && config.playlist.length > 0) {
    const firstItem = config.playlist.find((item) =>
      typeof item === "string" ? item : item?.path
    );
    const firstPath = typeof firstItem === "string" ? firstItem : firstItem?.path;
    if (firstPath) {
      folderPath = path.dirname(firstPath);
    }
  }

  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }

  config.musicFolderPath = folderPath;
  saveConfig(config);

  return scanMusicFolder(folderPath);
});

// Open file dialog and return audio file paths
ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    title: "Select Music Files",
    filters: [
      {
        name: "Audio Files",
        extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma"],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return result.filePaths;
});

// Get basic metadata from filename (fast)
ipcMain.handle("get-file-info", async (event, filePath) => {
  try {
    const name = path.basename(filePath);
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");

    // Get file size
    const stats = fs.statSync(filePath);
    const size = stats.size;

    // Try to parse artist - title format
    let title = nameWithoutExt;
    let artist = "Unknown Artist";

    // Common formats: "Artist - Title" or "01 - Title" or "01. Title"
    const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      const first = dashMatch[1].trim();
      const second = dashMatch[2].trim();
      // If first part is a number, it's probably track number
      if (/^\d+$/.test(first)) {
        title = second;
      } else {
        artist = first;
        title = second;
      }
    }

    return { title, artist, name, size };
  } catch (e) {
    return {
      title: path.basename(filePath).replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      name: path.basename(filePath),
      size: null,
    };
  }
});

// Extract full metadata with cover art from file (using music-metadata for duration support)
ipcMain.handle("extract-metadata", async (event, filePath) => {
  try {
    const mm = await import("music-metadata"); // Dynamic import for ESM

    // Check cache first
    const coverHash = getCoverHash(filePath);
    let coverPath = undefined;

    if (coverHash) {
      const cachedCoverPath = path.join(COVERS_DIR, `${coverHash}.jpg`);
      if (fs.existsSync(cachedCoverPath)) {
        coverPath = `file://${cachedCoverPath.replace(/\\/g, "/")}`;
      }
    }

    // Optimization: If we have a cached cover, we might still want to read metadata for title/artist/duration
    // options: skipCovers: true if we already have it? 
    // music-metadata parses everything fast, but avoiding picture parsing helps.
    // However, if we don't have the cover, we need to read it.

    const metadata = await mm.parseFile(filePath, { skipCovers: !!coverPath });

    const common = metadata.common;
    const format = metadata.format;

    const name = path.basename(filePath);
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");

    // Fallback logic
    let title = common.title || nameWithoutExt;
    let artist = common.artist || "Unknown Artist";
    let album = common.album || "Unknown Album";

    // Parse filename if tags are missing
    if (!common.title && !common.artist) {
      const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
      if (dashMatch) {
        const first = dashMatch[1].trim();
        const second = dashMatch[2].trim();
        if (/^\d+$/.test(first)) {
          title = second;
        } else {
          artist = first;
          title = second;
        }
      }
    }

    // Process Cover if not cached
    if (!coverPath && common.picture && common.picture.length > 0) {
      try {
        const pic = common.picture[0];
        const buffer = Buffer.from(pic.data);
        const cachedPath = path.join(COVERS_DIR, `${coverHash}.jpg`);
        fs.writeFileSync(cachedPath, buffer);
        coverPath = `file://${cachedPath.replace(/\\/g, "/")}`;
      } catch (e) {
        console.error("Failed to write cover cache:", e);
      }
    }

    return {
      title,
      artist,
      album,
      cover: coverPath, // Now returning file:// URL or undefined
      duration: format.duration,
      year: common.year,
    };

  } catch (error) {
    console.error("Error reading metadata with music-metadata:", error);
    // Fallback to basic filename parsing
    const name = path.basename(filePath);
    return {
      title: name.replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      album: "Unknown Album",
      cover: undefined,
      duration: 0,
    };
  }
});

