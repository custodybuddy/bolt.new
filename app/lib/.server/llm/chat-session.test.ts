import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatSession } from './chat-session';
import { CONTINUE_PROMPT } from './prompts';
import { type Messages, type StreamingOptions } from './stream-text';

vi.mock('./stream-text', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./stream-text')>();
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

const encoder = new TextEncoder();
const streamTextModule = await import('./stream-text');
const streamTextMock = vi.mocked(streamTextModule.streamText);

function createReadable(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

type FinishHandler = NonNullable<StreamingOptions['onFinish']>;

describe('createChatSession', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
  });

  it('streams responses with continuation when truncated', async () => {
    const firstOnFinish: FinishHandler[] = [];
    const secondOnFinish: FinishHandler[] = [];

    streamTextMock.mockImplementationOnce(async (_messages, _env, options) => {
      if (options?.onFinish) {
        firstOnFinish.push(options.onFinish);
      }

      return {
        toAIStream() {
          return createReadable('first');
        },
      } as any;
    });

    streamTextMock.mockImplementationOnce(async (messages, _env, options) => {
      expect(messages.at(-2)).toEqual({ role: 'assistant', content: 'first' });
      expect(messages.at(-1)).toEqual({ role: 'user', content: CONTINUE_PROMPT });

      if (options?.onFinish) {
        secondOnFinish.push(options.onFinish);
      }

      return {
        toAIStream() {
          return createReadable('second');
        },
      } as any;
    });

    const messages: Messages = [{ role: 'user', content: 'Hello' }];

    const response = await createChatSession({
      messages,
      env: {} as Env,
      continueOnTruncation: true,
    });

    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');

    await firstOnFinish[0]?.({
      text: 'first',
      finishReason: 'length',
    } as any);

    await secondOnFinish[0]?.({
      text: 'second',
      finishReason: 'stop',
    } as any);

    const text = await response.text();

    expect(text).toBe('firstsecond');
    expect(streamTextMock).toHaveBeenCalledTimes(2);
  });

  it('stops continuation when segment limit is reached', async () => {
    const firstOnFinish: FinishHandler[] = [];
    const secondOnFinish: FinishHandler[] = [];

    streamTextMock.mockImplementationOnce(async (_messages, _env, options) => {
      if (options?.onFinish) {
        firstOnFinish.push(options.onFinish);
      }

      return {
        toAIStream() {
          return createReadable('first');
        },
      } as any;
    });

    streamTextMock.mockImplementationOnce(async (_messages, _env, options) => {
      if (options?.onFinish) {
        secondOnFinish.push(options.onFinish);
      }

      return {
        toAIStream() {
          return createReadable('second');
        },
      } as any;
    });

    const messages: Messages = [{ role: 'user', content: 'Hello' }];

    const response = await createChatSession({
      messages,
      env: {} as Env,
      continueOnTruncation: true,
    });

    await firstOnFinish[0]?.({
      text: 'first',
      finishReason: 'length',
    } as any);

    await expect(
      secondOnFinish[0]?.({
        text: 'second',
        finishReason: 'length',
      } as any),
    ).rejects.toThrow('Cannot continue message: Maximum segments reached');
  });

  it('applies enhancer transforms to the response stream', async () => {
    const finishHandlers: FinishHandler[] = [];

    streamTextMock.mockResolvedValueOnce({
      toAIStream() {
        return createReadable('one\ntwo');
      },
    } as any);

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const upper = text.toUpperCase();
        controller.enqueue(new TextEncoder().encode(upper));
      },
    });

    const response = await createChatSession({
      messages: [{ role: 'user', content: 'Hello' }],
      env: {} as Env,
      transforms: [transform],
    });

    const options = streamTextMock.mock.calls[0]?.[2];
    if (options?.onFinish) {
      finishHandlers.push(options.onFinish);
    }

    await finishHandlers[0]?.({
      text: 'one\ntwo',
      finishReason: 'stop',
    } as any);

    const text = await response.text();
    expect(text).toBe('ONE\nTWO');
  });
});
