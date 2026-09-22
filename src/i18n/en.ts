export const en = {
  lang: {
    label: 'Language',
    en: 'EN',
    zh: '中文',
  },
  app: {
    tagline: 'Drop a video. GIF appears next to it.',
    modeTitle: 'Switch mode',
  },
  mode: {
    simple: 'Simple',
    advanced: 'Advanced',
  },
  browser: {
    title: 'Notice',
    tauriHintBefore: 'Please start this app with Tauri: ',
    tauriHintAfter:
      '. Browser preview cannot access local file paths or ffmpeg.',
    smokeHintBefore: 'Headless smoke test: ',
    smokeHintMid: ' or ',
  },
  drop: {
    title: 'Drop a video here',
    sub: 'Supports common formats such as mp4 / mov / webm / mkv / avi',
    choose: 'Choose video…',
    change: 'Change…',
    duration: ' · duration {duration}',
  },
  simple: {
    dropTitle: 'Drop a video',
    dropSub: 'GIF is saved in the same folder',
    orClick: 'or click to choose',
    converting: 'Converting {name}…',
    saved: 'Saved {name} in the same folder',
  },
  advanced: {
    title: 'Advanced options',
    width: 'Width (keep aspect ratio)',
    fps: 'Frame rate (fps)',
    start: 'Start time (seconds)',
    trim: 'Clip duration (seconds)',
    loop: 'Loop (0 = infinite, -1 = none)',
    colors: 'Colors',
    dither: 'Dither algorithm',
    ditherRecommended: 'sierra2_4a (recommended)',
    ditherNone: 'None',
    speed: 'Playback speed (1 = original)',
    outputPath: 'Output path',
    browse: 'Browse…',
  },
  actions: {
    convertAdvanced: 'Start conversion',
    cancel: 'Cancel conversion',
    showInFolder: 'Show in folder',
    openGif: 'Open GIF',
  },
  progress: {
    preparing: 'Preparing…',
    converting: 'Converting…',
    cancelled: 'Cancelled',
    failed: 'Failed',
    done: 'Done',
  },
  status: {
    saved: 'Saved: {path}',
  },
  errors: {
    convertFailed: 'Conversion failed',
    inputMissing: 'Input file not found',
    outputMissing: 'Output path not specified',
    ffmpegMissing: 'ffmpeg is not available.\n{detail}',
    ffmpegBroken:
      'System ffmpeg is broken (missing library). On macOS run: brew reinstall ffmpeg',
    ffmpegFailed: '{detail}',
  },
  duration: {
    unknown: 'Unknown',
    seconds: '{n} s',
    minutes: '{m} min {s} s',
  },
  dialog: {
    selectVideoTitle: 'Choose video',
    selectVideoFilter: 'Video',
    saveGifTitle: 'Save GIF',
  },
};

export type Messages = typeof en;
