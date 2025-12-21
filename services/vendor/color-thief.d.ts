declare module 'services/vendor/color-thief' {
  export default class ColorThief {
    getColor(img: HTMLImageElement | null): number[];
    getPalette(img: HTMLImageElement | null, colorCount?: number): number[][];
  }
}
