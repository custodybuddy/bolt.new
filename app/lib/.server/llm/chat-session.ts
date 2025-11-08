import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

interface ChatSessionOptions {
  messages: Messages;
  env: Env;
  options?: StreamingOptions;
  continueOnTruncation?: boolean;
  transforms?: TransformStream<Uint8Array, Uint8Array>[];
}

export async function createChatSession({
  messages,
  env,
  options,
  continueOnTruncation = false,
  transforms = [],
}: ChatSessionOptions) {
  const stream = new SwitchableStream();

  const { onFinish: userOnFinish, ...rest } = options ?? {};

  const streamingOptions: StreamingOptions = {
    ...rest,
    onFinish: async (payload) => {
      try {
        await userOnFinish?.(payload);

        if (!continueOnTruncation || payload.finishReason !== 'length') {
          stream.close();
          return;
        }

        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw new Error('Cannot continue message: Maximum segments reached');
        }

        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

        console.log(
          `Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`,
        );

        messages.push({ role: 'assistant', content: payload.text });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const next = await streamText(messages, env, streamingOptions);

        await stream.switchSource(next.toAIStream());
      } catch (error) {
        throw error;
      }
    },
  };

  try {
    const result = await streamText(messages, env, streamingOptions);

    await stream.switchSource(result.toAIStream());

    let readable: ReadableStream<Uint8Array> = stream.readable as ReadableStream<Uint8Array>;

    for (const transform of transforms) {
      readable = readable.pipeThrough(transform);
    }

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.log(error);

    stream.close();

    if (error instanceof Response) {
      throw error;
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
