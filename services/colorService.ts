import ColorThief from "./vendor/color-thief";

const normalizeHex = (hex: string): string | null => {
    let value = hex.replace(/^\s*#|\s*$/g, '');
    if (value.length === 3) {
        value = value.replace(/(.)/g, '$1$1');
    }

    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
        return null;
    }

    return value.toLowerCase();
};

/**
 * Extracts the dominant color from an image URL using Color Thief.
 */
export const getDominantColor = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!imageSrc) {
      resolve("#111111");
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const color = colorThief.getColor(img);
        
        // Convert RGB array to Hex
        if (color) {
            const hex = "#" + color.map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            resolve(hex);
        } else {
             resolve("#111111");
        }

      } catch (e) {
        console.warn("Color extraction failed, using fallback", e);
        resolve("#111111");
      }
    };

    img.onerror = () => {
      resolve("#111111");
    };
  });
};

const rgbToHex = (color: number[]): string => {
    return "#" + color.map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
};

export const hexToRgb = (hex: string): [number, number, number] | null => {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;

    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
    ];
};

export const hexToRgbString = (hex: string): string => {
    const rgb = hexToRgb(hex) || [17, 17, 17];
    return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
};

export const mixColors = (colorA: string, colorB: string, weight: number = 0.5): string => {
    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);

    if (!rgbA && !rgbB) return "#111111";
    if (!rgbA) return colorB;
    if (!rgbB) return colorA;

    const t = Math.min(1, Math.max(0, weight));
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);

    return rgbToHex([
        mix(rgbA[0], rgbB[0]),
        mix(rgbA[1], rgbB[1]),
        mix(rgbA[2], rgbB[2]),
    ]);
};

/**
 * Extracts a small color palette from an image URL.
 */
export const getColorPalette = (imageSrc: string, colorCount: number = 6): Promise<string[]> => {
  return new Promise((resolve) => {
    if (!imageSrc) {
      resolve(["#111111"]);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, colorCount);

        if (palette && palette.length) {
          resolve(palette.map(rgbToHex));
        } else {
          resolve(["#111111"]);
        }
      } catch (e) {
        console.warn("Palette extraction failed, using fallback", e);
        resolve(["#111111"]);
      }
    };

    img.onerror = () => {
      resolve(["#111111"]);
    };
  });
};

/**
 * Adjusts brightness of a hex color
 * percent: -1.0 to 1.0 (negative to darken, positive to lighten)
 */
export const adjustBrightness = (hex: string, percent: number): string => {
    const normalized = normalizeHex(hex);
    if (!normalized) return "#000000";

    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return "#000000";

    const adjust = (val: number) => {
        const amount = Math.floor(255 * percent);
        return Math.min(255, Math.max(0, val + amount));
    };

    const newR = adjust(r).toString(16).padStart(2, '0');
    const newG = adjust(g).toString(16).padStart(2, '0');
    const newB = adjust(b).toString(16).padStart(2, '0');

    return `#${newR}${newG}${newB}`;
};

/**
 * Ensures a color is dark enough for white text readability.
 * If the color is too bright, it darkens it.
 */
export const ensureDarkColor = (hex: string, maxLuminance: number = 0.15): string => {
    let c = normalizeHex(hex);
    if (!c) return "#111111";

    let r = parseInt(c.substring(0, 2), 16);
    let g = parseInt(c.substring(2, 4), 16);
    let b = parseInt(c.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "#111111";

    const getLuminance = (r: number, g: number, b: number) => {
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };

    let luminance = getLuminance(r, g, b);
    
    // Iteratively darken if too bright
    let saftey = 0;
    while (luminance > maxLuminance && saftey < 10) {
        r = Math.floor(r * 0.8);
        g = Math.floor(g * 0.8);
        b = Math.floor(b * 0.8);
        luminance = getLuminance(r, g, b);
        saftey++;
    }

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
