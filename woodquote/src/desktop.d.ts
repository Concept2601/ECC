// Bridge exposed by the Windows desktop app (desktop/preload.cjs)
interface Window {
  woodquoteDesktop?: {
    platform: string;
    openFile: (name: string, bytes: ArrayBuffer) => Promise<string>;
  };
}
