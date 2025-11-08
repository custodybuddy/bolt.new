import { atom } from 'nanostores';
import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

export interface StoreChatParams {
  id: string;
  messages: Message[];
  urlId?: string;
  description?: string;
}

export interface ChatStorageService {
  readonly isEnabled: boolean;
  readonly chatId: typeof chatIdAtom;
  readonly description: typeof descriptionAtom;
  getChatId(): string | undefined;
  setChatId(value: string | undefined): void;
  getDescription(): string | undefined;
  setDescription(value: string | undefined): void;
  list(): Promise<ChatHistoryItem[]>;
  remove(id: string): Promise<void>;
  read(identifier: string): Promise<ChatHistoryItem | undefined>;
  write(params: StoreChatParams): Promise<void>;
  nextId(): Promise<string>;
  ensureUrlId(baseId: string): Promise<string>;
}

const logger = createScopedLogger('ChatHistory');

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

const chatIdAtom = atom<string | undefined>(undefined);
const descriptionAtom = atom<string | undefined>(undefined);

const databasePromise: Promise<IDBDatabase | undefined> = (async () => {
  if (!persistenceEnabled) {
    return undefined;
  }

  if (typeof indexedDB === 'undefined') {
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('chats')) {
        const store = db.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('id', 'id', { unique: true });
        store.createIndex('urlId', 'urlId', { unique: true });
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
})();

async function requireDatabase(): Promise<IDBDatabase> {
  const db = await databasePromise;

  if (!db) {
    throw new Error('Chat persistence is unavailable');
  }

  return db;
}

async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

async function setMessagesInternal(db: IDBDatabase, params: StoreChatParams): Promise<void> {
  const { id, messages, urlId, description } = params;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  }

  let i = 2;

  while (idList.includes(`${id}-${i}`)) {
    i++;
  }

  return `${id}-${i}`;
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        if (cursor.value.urlId) {
          idList.push(cursor.value.urlId);
        }

        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem | undefined> {
  return (await getMessagesById(db, id)) ?? (await getMessagesByUrlId(db, id));
}

class DefaultChatStorage implements ChatStorageService {
  readonly isEnabled = persistenceEnabled;
  readonly chatId = chatIdAtom;
  readonly description = descriptionAtom;

  getChatId() {
    return chatIdAtom.get();
  }

  setChatId(value: string | undefined) {
    chatIdAtom.set(value);
  }

  getDescription() {
    return descriptionAtom.get();
  }

  setDescription(value: string | undefined) {
    descriptionAtom.set(value);
  }

  async list(): Promise<ChatHistoryItem[]> {
    const db = await requireDatabase();
    return getAll(db);
  }

  async remove(id: string): Promise<void> {
    const db = await requireDatabase();
    await deleteById(db, id);
  }

  async read(identifier: string): Promise<ChatHistoryItem | undefined> {
    const db = await requireDatabase();
    return getMessages(db, identifier);
  }

  async write(params: StoreChatParams): Promise<void> {
    const db = await requireDatabase();
    await setMessagesInternal(db, params);
  }

  async nextId(): Promise<string> {
    const db = await requireDatabase();
    return getNextId(db);
  }

  async ensureUrlId(baseId: string): Promise<string> {
    const db = await requireDatabase();
    return getUrlId(db, baseId);
  }
}

export const chatStorage: ChatStorageService = new DefaultChatStorage();
export const chatId = chatIdAtom;
export const description = descriptionAtom;
