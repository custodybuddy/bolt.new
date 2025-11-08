import { useMemo } from 'react';
import { chatStore } from '~/lib/stores/chat';
import type { WorkbenchStore } from '~/lib/stores/workbench';

export function createChatAbortHandler(stop: () => void, workbenchStore: WorkbenchStore) {
  return () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  };
}

export function useChatAbort(stop: () => void, workbenchStore: WorkbenchStore) {
  return useMemo(() => createChatAbortHandler(stop, workbenchStore), [stop, workbenchStore]);
}
