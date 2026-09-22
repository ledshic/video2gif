import type { Messages } from './en';

/** Simplified Chinese (CHS). */
export const zhCN: Messages = {
  lang: {
    label: '语言',
    en: 'EN',
    zh: '中文',
  },
  app: {
    tagline: '拖入视频，GIF 出现在同一目录。',
    modeTitle: '切换模式',
  },
  mode: {
    simple: '简易',
    advanced: '高级',
  },
  browser: {
    title: '提示',
    tauriHintBefore: '请通过 Tauri 启动本应用：',
    tauriHintAfter: '。浏览器预览无法访问本地文件路径与 ffmpeg。',
    smokeHintBefore: '无界面冒烟测试：',
    smokeHintMid: ' 或 ',
  },
  drop: {
    title: '拖放视频到此处',
    sub: '支持 mp4 / mov / webm / mkv / avi 等常见格式',
    choose: '选择视频…',
    change: '更换…',
    duration: ' · 时长 {duration}',
  },
  simple: {
    dropTitle: '拖入视频',
    dropSub: 'GIF 保存在同一目录',
    orClick: '或点击选择',
    converting: '正在转换 {name}…',
    saved: '已保存 {name}（同一目录）',
  },
  advanced: {
    title: '高级参数',
    width: '宽度（保持比例）',
    fps: '帧率 (fps)',
    start: '起始时间（秒）',
    trim: '截取时长（秒）',
    loop: '循环（0=无限，-1=不循环）',
    colors: '颜色数',
    dither: '抖动算法',
    ditherRecommended: 'sierra2_4a（推荐）',
    ditherNone: '无抖动',
    speed: '播放速度（1=原速）',
    outputPath: '输出路径',
    browse: '浏览…',
  },
  actions: {
    convertAdvanced: '开始生成',
    cancel: '取消转换',
    showInFolder: '在文件夹中显示',
    openGif: '打开 GIF',
  },
  progress: {
    preparing: '准备中…',
    converting: '转换中…',
    cancelled: '已取消',
    failed: '失败',
    done: '完成',
  },
  status: {
    saved: '已保存：{path}',
  },
  errors: {
    convertFailed: '转换失败',
    inputMissing: '输入文件不存在',
    outputMissing: '未指定输出路径',
    ffmpegMissing: '无法使用 ffmpeg。\n{detail}',
    ffmpegBroken: '系统 ffmpeg 已损坏（缺少动态库）。macOS 请执行：brew reinstall ffmpeg',
    ffmpegFailed: 'ffmpeg 失败。\n{detail}',
  },
  duration: {
    unknown: '未知',
    seconds: '{n} 秒',
    minutes: '{m} 分 {s} 秒',
  },
  dialog: {
    selectVideoTitle: '选择视频',
    selectVideoFilter: '视频',
    saveGifTitle: '保存 GIF',
  },
};
