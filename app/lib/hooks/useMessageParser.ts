import type { Message } from 'ai';
import { useCallback, useEffect, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import type { WorkbenchStore } from '~/lib/stores/workbench';
import { useWorkbench } from '~/lib/stores/workbench/context';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

let getWorkbenchStore: (() => WorkbenchStore) | undefined;

const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      const store = getWorkbenchStore?.();

      if (!store) {
        return;
      }

      store.showWorkbench.set(true);
      store.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      const store = getWorkbenchStore?.();

      if (!store) {
        return;
      }

      store.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      // we only add shell actions when when the close tag got parsed because only then we have the content
      if (data.action.type !== 'shell') {
        getWorkbenchStore?.()?.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      if (data.action.type === 'shell') {
        getWorkbenchStore?.()?.addAction(data);
      }

      getWorkbenchStore?.()?.runAction(data);
    },
  },
});

export function useMessageParser() {
  const workbenchStore = useWorkbench();
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    getWorkbenchStore = () => workbenchStore;

    return () => {
      if (getWorkbenchStore && getWorkbenchStore() === workbenchStore) {
        getWorkbenchStore = undefined;
      }
    };
  }, [workbenchStore]);

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant') {
        const newParsedContent = messageParser.parse(message.id, message.content);

        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
