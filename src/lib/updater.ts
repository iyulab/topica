import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'available' | 'downloading' | 'ready';

export interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  progress?: number;
}

let info: UpdateInfo = { status: 'idle' };
let pendingUpdate: Update | null = null;
let listener: ((i: UpdateInfo) => void) | null = null;

function notify(i: UpdateInfo) {
  info = i;
  listener?.(i);
}

export function onUpdateState(cb: (i: UpdateInfo) => void): () => void {
  listener = cb;
  cb(info);
  return () => {
    if (listener === cb) listener = null;
  };
}

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (update) {
      pendingUpdate = update;
      notify({ status: 'available', version: update.version });
    }
  } catch {
    // 네트워크 없거나 업데이트 서버 미응답 — 조용히 무시
  }
}

export async function installUpdate(): Promise<void> {
  if (!pendingUpdate) return;
  try {
    let downloaded = 0;
    let total = 0;
    notify({ status: 'downloading', progress: 0 });

    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? 0;
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength;
        notify({
          status: 'downloading',
          progress: total > 0 ? Math.round((downloaded / total) * 100) : 0,
        });
      } else if (event.event === 'Finished') {
        notify({ status: 'ready' });
      }
    });

    await relaunch();
  } catch {
    notify({ status: 'idle' });
  }
}
