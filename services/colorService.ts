import ColorThief from "./vendor/color-thief";

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

/**
 * Adjusts brightness of a hex color
 * percent: -1.0 to 1.0 (negative to darken, positive to lighten)
 */
export const adjustBrightness = (hex: string, percent: number): string => {
    // strip the leading # if it's there
    hex = hex.replace(/^\s*#|\s*$/g, '');

    // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    if (hex.length === 3) {
        hex = hex.replace(/(.)/g, '$1$1');
    }

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

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
    // strip the leading # if it's there
    let c = hex.replace(/^\s*#|\s*$/g, '');
    if (c.length === 3) {
        c = c.replace(/(.)/g, '$1$1');
    }

    let r = parseInt(c.substr(0, 2), 16);
    let g = parseInt(c.substr(2, 2), 16);
    let b = parseInt(c.substr(4, 2), 16);
    
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
