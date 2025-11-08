import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createChatSession } from '~/lib/.server/llm/chat-session';
import { type Messages } from '~/lib/.server/llm/stream-text';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages } = await request.json<{ messages: Messages }>();

  return createChatSession({
    messages,
    env: context.cloudflare.env,
    continueOnTruncation: true,
  });
}
