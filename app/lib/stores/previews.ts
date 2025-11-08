import type { WebContainer } from '@webcontainer/api';
import { atom } from 'nanostores';

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

export class PreviewsStore {
  #availablePreviews = new Map<number, PreviewInfo>();
  #webcontainer: Promise<WebContainer>;
  #initPromise?: Promise<void>;
  #portListener?: (port: number, type: 'open' | 'close', url: string) => void;

  previews = atom<PreviewInfo[]>([]);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  init() {
    if (!this.#initPromise) {
      this.#initPromise = this.#registerListeners();
    }

    return this.#initPromise;
  }

  async #registerListeners() {
    const webcontainer = await this.#webcontainer;

    if (this.#portListener) {
      return;
    }

    this.#portListener = (port, type, url) => {
      let previewInfo = this.#availablePreviews.get(port);

      if (type === 'close' && previewInfo) {
        this.#availablePreviews.delete(port);
        this.previews.set(this.previews.get().filter((preview) => preview.port !== port));

        return;
      }

      const previews = this.previews.get();

      if (!previewInfo) {
        previewInfo = { port, ready: type === 'open', baseUrl: url };
        this.#availablePreviews.set(port, previewInfo);
        previews.push(previewInfo);
      }

      previewInfo.ready = type === 'open';
      previewInfo.baseUrl = url;

      this.previews.set([...previews]);
    };

    webcontainer.on('port', this.#portListener);
  }
}
