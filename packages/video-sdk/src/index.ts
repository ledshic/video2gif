/**
 * Thin TypeScript types for the Rust `video-sdk` crate.
 * Runtime conversion lives in Rust (Tauri commands / other Rust apps).
 * Another frontend can import these types without depending on the UI.
 */

export interface ChatPreset {
  name: string;
  labelZh: string;
  width: number;
  fps: number;
  maxDuration: number;
  colors: number;
  dither: string;
  loop: number;
  speed: number;
}

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

export interface ConvertResult {
  ok: boolean;
  output?: string;
  error?: string;
  cancelled?: boolean;
}

export interface ProgressUpdate {
  pct: number;
  message: string;
}

export interface SdkDefaults {
  width: number;
  fps: number;
  maxDuration: number;
  colors: number;
  dither: string;
  loop: number;
  speed: number;
  ffmpegPath: string;
}

/** Documented package / crate names for reuse. */
export const SDK_RUST_PACKAGE = 'video-sdk';
export const SDK_TS_PACKAGE = '@video2gif/sdk';
