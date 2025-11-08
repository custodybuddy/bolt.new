import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareMessageWithDiff } from './useChatDiffAttachment';
import { fileModificationsToHTML } from '~/utils/diff';

vi.mock('~/utils/diff', () => ({
  fileModificationsToHTML: vi.fn(() => '<diff>mock</diff>'),
}));

describe('prepareMessageWithDiff', () => {
  const fileModificationsToHTMLMock = vi.mocked(fileModificationsToHTML);

  beforeEach(() => {
    fileModificationsToHTMLMock.mockClear();
    fileModificationsToHTMLMock.mockReturnValue('<diff>mock</diff>');
  });

  it('returns the original message when there are no file modifications', async () => {
    const workbenchStore = {
      saveAllFiles: vi.fn(),
      getFileModifcations: vi.fn().mockReturnValue(undefined),
      resetAllFileModifications: vi.fn(),
    } as unknown as Parameters<typeof prepareMessageWithDiff>[0];

    const prepared = await prepareMessageWithDiff(workbenchStore, 'message');

    expect(workbenchStore.saveAllFiles).toHaveBeenCalledTimes(1);
    expect(workbenchStore.getFileModifcations).toHaveBeenCalledTimes(1);
    expect(prepared.content).toBe('message');

    prepared.finalize();

    expect(workbenchStore.resetAllFileModifications).not.toHaveBeenCalled();
    expect(fileModificationsToHTMLMock).not.toHaveBeenCalled();
  });

  it('prefixes the message with a diff and resets modifications after finalize', async () => {
    const modifications = {
      '/index.ts': { type: 'diff', content: 'diff' },
    } as const;
    const workbenchStore = {
      saveAllFiles: vi.fn(),
      getFileModifcations: vi.fn().mockReturnValue(modifications),
      resetAllFileModifications: vi.fn(),
    } as unknown as Parameters<typeof prepareMessageWithDiff>[0];

    fileModificationsToHTMLMock.mockReturnValue('<bolt>diff</bolt>');

    const prepared = await prepareMessageWithDiff(workbenchStore, 'message');

    expect(workbenchStore.saveAllFiles).toHaveBeenCalledTimes(1);
    expect(workbenchStore.getFileModifcations).toHaveBeenCalledTimes(1);
    expect(fileModificationsToHTMLMock).toHaveBeenCalledWith(modifications);
    expect(prepared.content).toBe('<bolt>diff</bolt>\n\nmessage');

    prepared.finalize();

    expect(workbenchStore.resetAllFileModifications).toHaveBeenCalledTimes(1);
  });
});
