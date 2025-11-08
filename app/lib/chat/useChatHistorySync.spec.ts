import type { Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncChatHistory } from './useChatHistorySync';

const mockMessages: Message[] = [
  { id: '1', role: 'user', content: 'hello' },
  { id: '2', role: 'assistant', content: 'response' },
];

describe('syncChatHistory', () => {
  const originalWindow = globalThis.window;
  const replaceState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - minimal window mock for tests
    globalThis.window = {
      location: { href: 'https://example.com/chat/old' },
      history: { replaceState },
    };
  });

  afterEach(() => {
    // @ts-expect-error - reset mock window
    globalThis.window = originalWindow;
  });

  it('persists messages and updates navigation when provided', async () => {
    const storeMessageHistory = vi.fn().mockResolvedValue({ navigationTarget: 'next' });
    const workbenchStore = {
      firstArtifact: { id: 'artifact', title: 'Artifact Title', closed: false, runner: {} },
    } as const;

    await syncChatHistory({ messages: mockMessages, storeMessageHistory, workbenchStore });

    expect(storeMessageHistory).toHaveBeenCalledWith(mockMessages, {
      artifactId: 'artifact',
      description: 'Artifact Title',
    });
    expect(replaceState).toHaveBeenCalledTimes(1);
    const [, , target] = replaceState.mock.calls[0];
    expect(target instanceof URL ? target.toString() : target).toBe('https://example.com/chat/next');
  });

  it('swallows persistence errors', async () => {
    const error = new Error('failure');
    const storeMessageHistory = vi.fn().mockRejectedValue(error);
    const workbenchStore = {
      firstArtifact: undefined,
    } as const;

    await expect(
      syncChatHistory({ messages: mockMessages, storeMessageHistory, workbenchStore }),
    ).resolves.toBeUndefined();

    expect(storeMessageHistory).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
