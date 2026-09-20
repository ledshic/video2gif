/// <reference types="vite/client" />

export interface ConvertOptions {
  input: string;
  output: string;
  width?: number;
  fps?: number;
  start?: number;
  duration?: number;
  loop?: number;
  colors?: number;
  dither?: string;
  speed?: number;
}

export interface Video2GifApi {
  getDefaults: () => Promise<{
    width: number;
    fps: number;
    maxDuration: number;
    colors: number;
    dither: string;
    loop: number;
    speed: number;
    ffmpegPath: string;
  }>;
  probeDuration: (input: string) => Promise<number | null>;
  selectVideo: () => Promise<string | null>;
  selectOutput: (defaultName?: string) => Promise<string | null>;
  showItemInFolder: (filePath: string) => Promise<void>;
  openPath: (filePath: string) => Promise<string>;
  defaultOutputPath: (input: string) => Promise<string>;
  convert: (opts: ConvertOptions) => Promise<{
    ok: boolean;
    output?: string;
    error?: string;
    cancelled?: boolean;
  }>;
  cancelConvert: () => Promise<boolean>;
  onProgress: (cb: (data: { pct: number; message: string }) => void) => () => void;
}

declare global {
  interface Window {
    video2gif: Video2GifApi;
  }
}

export {};
