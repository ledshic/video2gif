import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open, save } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { openPath } from '@tauri-apps/plugin-opener';
import type { ConvertOptions, ConvertResult, ProgressUpdate, SdkDefaults } from '@video2gif/sdk';

export type DragDropState = 'enter' | 'over' | 'drop' | 'leave';

export type DragPoint = { x: number; y: number };

export async function onNativeDragDrop(
  cb: (state: DragDropState, paths?: string[], position?: DragPoint) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    const payload = event.payload;
    if (payload.type === 'drop') {
      cb('drop', payload.paths, payload.position);
    } else if (payload.type === 'leave') {
      cb('leave');
    } else if (payload.type === 'enter') {
      cb('enter', payload.paths, payload.position);
    } else {
      cb('over', undefined, payload.position);
    }
  });
}

export async function getDefaults(): Promise<SdkDefaults> {
  return invoke('get_defaults');
}

export async function probeDuration(input: string): Promise<number | null> {
  return invoke('probe_duration_cmd', { input });
}

export async function defaultOutputPath(input: string): Promise<string> {
  return invoke('default_output_path_cmd', { input });
}

export async function convert(opts: ConvertOptions): Promise<ConvertResult> {
  return invoke('convert', { opts });
}

export async function cancelConvert(): Promise<boolean> {
  return invoke('cancel_convert');
}

export async function onProgress(
  cb: (data: ProgressUpdate) => void,
): Promise<UnlistenFn> {
  return listen<ProgressUpdate>('convert-progress', (e) => cb(e.payload));
}

export async function selectVideo(labels?: {
  title?: string;
  filterName?: string;
}): Promise<string | null> {
  const selected = await open({
    title: labels?.title ?? 'Choose video',
    multiple: false,
    filters: [
      {
        name: labels?.filterName ?? 'Video',
        extensions: [
          'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'flv', 'wmv', 'mpeg', 'mpg', 'ts', 'gif',
        ],
      },
    ],
  });
  if (selected == null) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function selectOutput(
  defaultName?: string,
  title?: string,
): Promise<string | null> {
  const p = await save({
    title: title ?? 'Save GIF',
    defaultPath: defaultName || 'output.gif',
    filters: [{ name: 'GIF', extensions: ['gif'] }],
  });
  return p ?? null;
}

export async function showItemInFolder(filePath: string): Promise<void> {
  await revealItemInDir(filePath);
}

export async function openGif(filePath: string): Promise<void> {
  await openPath(filePath);
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
