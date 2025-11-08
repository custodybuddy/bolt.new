import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createChatAbortHandler } from './useChatAbort';
import { chatStore } from '~/lib/stores/chat';

describe('createChatAbortHandler', () => {
  beforeEach(() => {
    chatStore.setKey('aborted', false);
  });

  it('stops the chat stream and aborts workbench actions', () => {
    const stop = vi.fn();
    const workbenchStore = {
      abortAllActions: vi.fn(),
    } as unknown as Parameters<typeof createChatAbortHandler>[1];

    const handler = createChatAbortHandler(stop, workbenchStore);

    handler();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(workbenchStore.abortAllActions).toHaveBeenCalledTimes(1);
    expect(chatStore.get().aborted).toBe(true);
  });
});
