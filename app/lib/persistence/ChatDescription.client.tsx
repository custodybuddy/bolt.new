import { useStore } from '@nanostores/react';
import { chatStorage } from './chat-storage';

export function ChatDescription() {
  return useStore(chatStorage.description);
}
