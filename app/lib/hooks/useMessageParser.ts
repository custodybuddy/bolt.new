import type { Message } from 'ai';
import { useCallback, useEffect, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import type { ActionEventsMediator } from '~/lib/runtime/action-events';
import { useActionEvents } from '~/lib/runtime/action-events';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

let getActionEvents: (() => ActionEventsMediator) | undefined;

const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      const actionEvents = getActionEvents?.();

      actionEvents?.emitArtifactOpen(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      const actionEvents = getActionEvents?.();

      actionEvents?.emitArtifactClose(data);
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      const actionEvents = getActionEvents?.();

      actionEvents?.emitActionOpen(data);
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      const actionEvents = getActionEvents?.();

      actionEvents?.emitActionClose(data);
    },
  },
});

export function useMessageParser() {
  const actionEvents = useActionEvents();
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    getActionEvents = () => actionEvents;

    return () => {
      if (getActionEvents && getActionEvents() === actionEvents) {
        getActionEvents = undefined;
      }
    };
  }, [actionEvents]);

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
