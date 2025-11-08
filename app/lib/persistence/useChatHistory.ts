import { useLoaderData } from '@remix-run/react';
import { useCallback, useEffect, useState } from 'react';
import type { Message } from 'ai';
import { chatStorage, type ChatStorageService, type ChatHistoryItem } from './chat-storage';

export interface StoreMessageOptions {
  artifactId?: string;
  description?: string;
}

export interface StoreMessageResult {
  chatId: string;
  urlId?: string;
  description?: string;
  isNewChat: boolean;
  navigationTarget?: string;
}

interface UseChatHistoryOptions {
  storage?: ChatStorageService;
}

export type StoreMessageHandler = (
  messages: Message[],
  options?: StoreMessageOptions,
) => Promise<StoreMessageResult | undefined>;

interface UseChatHistoryState {
  ready: boolean;
  initialMessages: Message[];
  urlId?: string;
  error?: Error;
  missingChat?: boolean;
  storeMessageHistory: StoreMessageHandler;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown error');
}

export function useChatHistory(options: UseChatHistoryOptions = {}): UseChatHistoryState {
  const storage = options.storage ?? chatStorage;
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(!mixedId);
  const [urlId, setUrlId] = useState<string | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [missingChat, setMissingChat] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    if (!mixedId) {
      setReady(true);

      return () => {
        cancelled = true;
      };
    }

    storage
      .read(mixedId)
      .then((stored) => {
        if (cancelled) {
          return;
        }

        if (stored && stored.messages.length > 0) {
          handleExistingChat(storage, stored, setInitialMessages, setUrlId);
        } else {
          setMissingChat(true);
        }
      })
      .catch((caughtError) => {
        if (cancelled) {
          return;
        }

        setError(normalizeError(caughtError));
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mixedId, storage]);

  const storeMessageHistory = useCallback<UseChatHistoryState['storeMessageHistory']>(
    async (messages, options) => {
      if (messages.length === 0) {
        return undefined;
      }

      try {
        let chatId = storage.getChatId();
        let isNewChat = false;
        let navigationTarget: string | undefined;

        if (!chatId) {
          chatId = await storage.nextId();
          storage.setChatId(chatId);
          isNewChat = true;
        }

        let nextUrlId = urlId;

        if (!nextUrlId && options?.artifactId) {
          nextUrlId = await storage.ensureUrlId(options.artifactId);
          setUrlId(nextUrlId);
          navigationTarget = nextUrlId;
        }

        const existingDescription = storage.getDescription();
        let resolvedDescription = existingDescription;

        if (!existingDescription && options?.description) {
          storage.setDescription(options.description);
          resolvedDescription = options.description;
        }

        await storage.write({
          id: chatId,
          messages,
          urlId: nextUrlId,
          description: resolvedDescription,
        });

        if (!navigationTarget && isNewChat && !nextUrlId) {
          navigationTarget = chatId;
        }

        return {
          chatId,
          urlId: nextUrlId,
          description: resolvedDescription,
          isNewChat,
          navigationTarget,
        };
      } catch (caughtError) {
        const normalized = normalizeError(caughtError);
        setError(normalized);
        throw normalized;
      }
    },
    [storage, urlId],
  );

  return {
    ready,
    initialMessages,
    urlId,
    error,
    missingChat,
    storeMessageHistory,
  };
}

function handleExistingChat(
  storage: ChatStorageService,
  stored: ChatHistoryItem,
  setInitialMessages: (messages: Message[]) => void,
  setUrlId: (value: string | undefined) => void,
) {
  setInitialMessages(stored.messages);
  setUrlId(stored.urlId);
  storage.setDescription(stored.description);
  storage.setChatId(stored.id);
}
