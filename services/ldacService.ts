// services/ldacService.ts
import { app } from 'electron';
import path from 'path';

// Define the interface for the native module
interface LdacNative {
  encode(pcmData: Buffer): Buffer;
  getBitrate(): number;
}

// Define the class structure of the native addon
interface LdacEncoderClass {
  new (mtu: number, eqmid: number, channelMode: number, fmt: number, samplingFreq: number): LdacNative;
}

let LdacEncoder: LdacEncoderClass | null = null;
let isLdacAvailable = false;

try {
  // Try to load the native binding
  const bindingPath = path.resolve(__dirname, '../../native/ldac');
  // Alternatively try the standard bindings lookup
  const native = require(bindingPath);
  LdacEncoder = native.LdacEncoder;
  isLdacAvailable = true;
  console.log('LDAC Native Module loaded successfully');
} catch (e) {
  console.warn('LDAC Native Module not found or failed to load:', e);
  // Fallback or just disable LDAC
  isLdacAvailable = false;
}

export const LDAC_QUALITY = {
  HQ: 0, // 990kbps
  SQ: 1, // 660kbps
  MQ: 2  // 330kbps
};

export const LDAC_CHANNEL_MODE = {
  STEREO: 0x00,
  DUAL: 0x01,
  MONO: 0x02
};

export class LdacService {
  private encoder: LdacNative | null = null;

  constructor() {
    if (isLdacAvailable && LdacEncoder) {
      // Initialize with default High Quality settings (96kHz, 24bit, Stereo)
      // MTU: 679 (typical)
      this.encoder = new LdacEncoder(679, LDAC_QUALITY.HQ, LDAC_CHANNEL_MODE.STEREO, 0x2, 44100);
    }
  }

  public isAvailable(): boolean {
    return isLdacAvailable;
  }

  public encode(pcmBuffer: Buffer): Buffer | null {
    if (!this.encoder) return null;
    return this.encoder.encode(pcmBuffer);
  }

  public getBitrate(): number {
    if (!this.encoder) return 0;
    return this.encoder.getBitrate();
  }
}

export const ldacService = new LdacService();
