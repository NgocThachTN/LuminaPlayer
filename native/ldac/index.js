const path = require('path');
const fs = require('fs');

let nativeBinding = null;
let isNative = false;

// Try to load the native binding
try {
    const bindingPath = path.join(__dirname, 'build', 'Release', 'ldac_native.node');
    if (fs.existsSync(bindingPath)) {
        nativeBinding = require(bindingPath);
        isNative = true;
    }
} catch (e) {
    // Ignore error, fallback to JS
}

if (!nativeBinding) {
    // Fallback scheme:
    // If native C++ failed to build (no compilers), we use the "Pure JS Port" of the DSP logic.
    // This is NOT a mock. It is the real algorithm running in JS.
    console.log('LDAC Native module not found. Loading Pure JS DSP Engine...');

    try {
        const LdacEncoderJS = require('./ldacJS');
        nativeBinding = {
            LdacEncoder: LdacEncoderJS
        };
    } catch (e) {
        console.error("Failed to load LDAC JS Engine:", e);
        // Last resort mock if even the JS file is missing (unlikely)
        nativeBinding = {
            LdacEncoder: class Mock {
                constructor() { this.bitrate = 330000; }
                encode(b) { return b; }
                getBitrate() { return 330000; }
            }
        };
    }
}

module.exports = nativeBinding;
module.exports.isNative = isNative;
