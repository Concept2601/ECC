// Bridge exposed by the Windows desktop app (desktop/preload.cjs)
interface Window {
  woodquoteDesktop?: {
    platform: string;
    openFile: (name: string, bytes: ArrayBuffer) => Promise<string>;
    saveBackup?: (name: string, json: string) => Promise<string>;
    setMenu?: (menu: DesktopMenuItem[]) => void;
    onCommand?: (fn: (id: string) => void) => void;
    systemInfo?: () => Promise<{ os: string; cpu: string; cores: number; ramMb: number; heapMb: number; gpu: string[] | null; gpuStatus: Record<string, string>; electron: string; chrome: string }>;
  };
}

interface DesktopMenuItem {
  id: string;
  label: string;
  group: string;
  accelerator?: string;
}
