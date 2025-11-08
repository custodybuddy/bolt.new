import { useCallback } from 'react';
import type { WorkbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';

export interface PreparedMessage {
  content: string;
  finalize: () => void;
}

export async function prepareMessageWithDiff(workbenchStore: WorkbenchStore, input: string): Promise<PreparedMessage> {
  /**
   * @note (delm) Usually saving files shouldn't take long but it may take longer if there
   * many unsaved files. In that case we need to block user input and show an indicator
   * of some kind so the user is aware that something is happening. But I consider the
   * happy case to be no unsaved files and I would expect users to save their changes
   * before they send another message.
   */
  await workbenchStore.saveAllFiles();

  const fileModifications = workbenchStore.getFileModifcations();

  if (fileModifications === undefined) {
    return {
      content: input,
      finalize: () => {},
    };
  }

  const diff = fileModificationsToHTML(fileModifications);

  return {
    content: diff ? `${diff}\n\n${input}` : input,
    finalize: () => {
      workbenchStore.resetAllFileModifications();
    },
  };
}

export function useChatDiffAttachment(workbenchStore: WorkbenchStore) {
  return useCallback((input: string) => prepareMessageWithDiff(workbenchStore, input), [workbenchStore]);
}
