import { useEffect } from 'react';
import type { Message } from 'ai';
import type { StoreMessageHandler } from '~/lib/persistence';
import type { WorkbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatHistorySync');

interface UseChatHistorySyncOptions {
  initialMessages: Message[];
  messages: Message[];
  storeMessageHistory: StoreMessageHandler;
  workbenchStore: WorkbenchStore;
}

export interface ChatHistorySyncOptions {
  messages: Message[];
  storeMessageHistory: StoreMessageHandler;
  workbenchStore: WorkbenchStore;
}

export async function syncChatHistory({
  messages,
  storeMessageHistory,
  workbenchStore,
}: ChatHistorySyncOptions) {
  const { firstArtifact } = workbenchStore;

  try {
    const result = await storeMessageHistory(messages, {
      artifactId: firstArtifact?.id,
      description: firstArtifact?.title,
    });

    if (result?.navigationTarget) {
      replaceChatRoute(result.navigationTarget);
    }
  } catch (error) {
    logger.error('Failed to persist chat history', error);
  }
}

export function useChatHistorySync({
  initialMessages,
  messages,
  storeMessageHistory,
  workbenchStore,
}: UseChatHistorySyncOptions) {
  useEffect(() => {
    if (messages.length <= initialMessages.length) {
      return;
    }

    void syncChatHistory({ messages, storeMessageHistory, workbenchStore });
  }, [initialMessages.length, messages, storeMessageHistory, workbenchStore]);
}

function replaceChatRoute(nextId: string) {
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
