import { createContext, useContext, type PropsWithChildren } from 'react';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';

export type ArtifactEventHandler = (data: ArtifactCallbackData) => void;
export type ActionEventHandler = (data: ActionCallbackData) => void;

type Unsubscribe = () => void;

export class ActionEventsMediator {
  #artifactOpenListeners = new Set<ArtifactEventHandler>();
  #artifactCloseListeners = new Set<ArtifactEventHandler>();
  #actionOpenListeners = new Set<ActionEventHandler>();
  #actionCloseListeners = new Set<ActionEventHandler>();

  onArtifactOpen(handler: ArtifactEventHandler): Unsubscribe {
    this.#artifactOpenListeners.add(handler);

    return () => {
      this.#artifactOpenListeners.delete(handler);
    };
  }

  onArtifactClose(handler: ArtifactEventHandler): Unsubscribe {
    this.#artifactCloseListeners.add(handler);

    return () => {
      this.#artifactCloseListeners.delete(handler);
    };
  }

  onActionOpen(handler: ActionEventHandler): Unsubscribe {
    this.#actionOpenListeners.add(handler);

    return () => {
      this.#actionOpenListeners.delete(handler);
    };
  }

  onActionClose(handler: ActionEventHandler): Unsubscribe {
    this.#actionCloseListeners.add(handler);

    return () => {
      this.#actionCloseListeners.delete(handler);
    };
  }

  emitArtifactOpen(data: ArtifactCallbackData): void {
    for (const handler of this.#artifactOpenListeners) {
      handler(data);
    }
  }

  emitArtifactClose(data: ArtifactCallbackData): void {
    for (const handler of this.#artifactCloseListeners) {
      handler(data);
    }
  }

  emitActionOpen(data: ActionCallbackData): void {
    for (const handler of this.#actionOpenListeners) {
      handler(data);
    }
  }

  emitActionClose(data: ActionCallbackData): void {
    for (const handler of this.#actionCloseListeners) {
      handler(data);
    }
  }
}

export const actionEvents = new ActionEventsMediator();

const ActionEventsContext = createContext<ActionEventsMediator>(actionEvents);

export function ActionEventsProvider({
  children,
  value,
}: PropsWithChildren<{ value?: ActionEventsMediator }>): JSX.Element {
  return <ActionEventsContext.Provider value={value ?? actionEvents}>{children}</ActionEventsContext.Provider>;
}

export function useActionEvents(): ActionEventsMediator {
  return useContext(ActionEventsContext);
}
