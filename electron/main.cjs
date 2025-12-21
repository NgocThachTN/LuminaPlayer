const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const jsmediatags = require("jsmediatags");
const DiscordRPC = require("discord-rpc");

// Discord Rich Presence Configuration
// Create your app at: https://discord.com/developers/applications
// Discord Rich Presence Configuration
// Create your app at: https://discord.com/developers/applications
const DISCORD_CLIENT_ID = "1451554863283703989"; // Replace with your Discord Application ID
let rpc = null;
let rpcReady = false;
let rpcRetryTimeout = null;
let lastPresence = null; // Cache for reconnection

// Initialize Discord RPC with Auto-Reconnection
function initDiscordRPC() {
  try {
    DiscordRPC.register(DISCORD_CLIENT_ID);

    const connect = () => {
      // Clean up previous instance
      if (rpc) {
        try { rpc.destroy(); } catch (_) { }
        rpc = null;
      }

      rpc = new DiscordRPC.Client({ transport: "ipc" });

      rpc.on("ready", () => {
        console.log("Discord RPC Connected!");
        rpcReady = true;

        // Restore last known presence upon connection
        if (lastPresence && lastPresence.isPlaying) {
          updateDiscordPresence(lastPresence);
        } else {
          rpc.setActivity({
            details: "Idle",
            state: "Not playing anything",
            largeImageKey: "lumina_icon",
            largeImageText: "Lumina Music Player",
            instance: false,
          });
        }
      });

      rpc.on("disconnected", () => {
        console.log("Discord RPC Disconnected. Retrying in 5s...");
        rpcReady = false;

        if (rpcRetryTimeout) clearTimeout(rpcRetryTimeout);
        rpcRetryTimeout = setTimeout(connect, 5000);
      });

      rpc.login({ clientId: DISCORD_CLIENT_ID }).catch((err) => {
        // Discord likely not running
        rpcReady = false;

        if (rpcRetryTimeout) clearTimeout(rpcRetryTimeout);
        rpcRetryTimeout = setTimeout(connect, 5000);
      });
    };

    connect();
  } catch (err) {
    console.error("Discord RPC initialization error:", err);
  }
}

// Format seconds to m:ss
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Format progress as time only (clean look)
function createProgressBar(current, total) {
  return ""; // No text progress bar - just use time
}

// Update Discord Rich Presence (Spotify-like style)
// Cache for cover art to avoid redundant API calls
const coverCache = new Map();

// Helper: Fetch Cover Art from iTunes
async function fetchCoverArt(title, artist) {
  const key = `${title}-${artist}`;
  if (coverCache.has(key)) return coverCache.get(key);

  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
    const data = await response.json();

    if (data.resultCount > 0 && data.results[0].artworkUrl100) {
      const url = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
      coverCache.set(key, url);
      // Limit cache size
      if (coverCache.size > 50) {
        const firstKey = coverCache.keys().next().value;
        coverCache.delete(firstKey);
      }
      return url;
    }
  } catch (e) {
    console.error("Cover Fetch Error:", e);
  }
  return null;
}

// Update Discord Rich Presence (Spotify-like style)
async function updateDiscordPresence(data) {
  if (!rpc || !rpcReady) return;

  try {
    const artist = data.artist || "Unknown Artist";
    const title = data.title || "Unknown Track";

    // Attempt to fetch cover art dynamically
    let largeImageKey = "lumina_icon"; // Default asset
    if (title && artist !== "Unknown Artist") {
      // Note: Check existing data.cover first in case provided by renderer
      if (data.cover) {
        largeImageKey = data.cover;
      } else {
        const fetchedUrl = await fetchCoverArt(title, artist);
        if (fetchedUrl) largeImageKey = fetchedUrl;
      }
    }

    // Activity Object
    const activity = {
      details: title,
      state: `by ${artist}`,
      largeImageKey: largeImageKey,
      largeImageText: "Lumina Music Player",
      smallImageKey: data.isPlaying ? "playing" : "paused",
      smallImageText: data.isPlaying ? "Playing" : "Paused",
      instance: false,
    };

    // Add timestamps? (Optional, makes it look better)
    if (data.isPlaying && data.duration) {
      // Calculate end time
      // data.currentTime is where we are NOW.
      // So endTimestamp = Date.now() + (remaining * 1000)
      const remaining = data.duration - data.currentTime;
      if (remaining > 0) {
        activity.endTimestamp = Date.now() + remaining * 1000;
      }
    }

    rpc.setActivity(activity);
  } catch (err) {
    console.error("Error updating Discord presence:", err);
  }
}

// Clear Discord Rich Presence
function clearDiscordPresence() {
  lastPresence = null;
  if (rpc && rpcReady) {
    try {
      rpc.clearActivity();
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

let mainWindow;

// Electron performance optimizations for Windows
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#000000",
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      backgroundThrottling: false, // Don't throttle when in background
      enableBlinkFeatures: 'CSSContentVisibilityAutoStateChange',
    },
    frame: true,
    titleBarStyle: "default",
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

  if (rpcRetryTimeout) clearTimeout(rpcRetryTimeout);

  if (rpc) {
    rpc.destroy();
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

// IPC handlers for playlist persistence
ipcMain.handle("save-playlist", (event, filePaths) => {
  const config = getConfig();
  config.playlist = filePaths;
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
  const audioExtensions = [
    ".mp3",
    ".wav",
    ".ogg",
    ".flac",
    ".m4a",
    ".aac",
    ".wma",
  ];

  try {
    const files = fs.readdirSync(folderPath);
    const audioFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return audioExtensions.includes(ext);
      })
      .map((file) => path.join(folderPath, file))
      .sort();

    return audioFiles;
  } catch (e) {
    console.error("Error reading folder:", e);
    return [];
  }
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

// Extract full metadata with cover art from file (using jsmediatags - reads only metadata, not entire file)
ipcMain.handle("extract-metadata", async (event, filePath) => {
  return new Promise((resolve) => {
    const name = path.basename(filePath);
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");

    // Default metadata from filename
    let defaultTitle = nameWithoutExt;
    let defaultArtist = "Unknown Artist";

    const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      const first = dashMatch[1].trim();
      const second = dashMatch[2].trim();
      if (/^\d+$/.test(first)) {
        defaultTitle = second;
      } else {
        defaultArtist = first;
        defaultTitle = second;
      }
    }

    jsmediatags.read(filePath, {
      onSuccess: (tag) => {
        const tags = tag.tags;
        let cover = undefined;

        // Extract cover art
        if (tags.picture) {
          const { data, format } = tags.picture;
          const base64 = Buffer.from(data).toString("base64");
          cover = `data:${format};base64,${base64}`;
        }

        resolve({
          title: tags.title || defaultTitle,
          artist: tags.artist || defaultArtist,
          album: tags.album || "Unknown Album",
          cover: cover,
        });
      },
      onError: (error) => {
        console.error("Error reading metadata:", error);
        resolve({
          title: defaultTitle,
          artist: defaultArtist,
          album: "Unknown Album",
          cover: undefined,
        });
      },
    });
  });
});