import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { shortcutsStore } from '~/lib/stores/settings';
import { webcontainer } from '~/lib/webcontainer';
import { useActionEvents } from '~/lib/runtime/action-events';
import { WorkbenchStore } from './index';

const WorkbenchContext = createContext<WorkbenchStore | null>(null);

export function WorkbenchProvider({ children }: PropsWithChildren): JSX.Element | null {
  const [store, setStore] = useState<WorkbenchStore | null>(() => {
    return (import.meta.hot?.data.workbenchStore as WorkbenchStore | undefined) ?? null;
  });
  const actionEvents = useActionEvents();

  useEffect(() => {
    if (store) {
      void store.init();
      return undefined;
    }

    let disposed = false;

    const createStore = async () => {
      try {
        const webcontainerInstance = await webcontainer;

        if (disposed) {
          return;
        }

        const workbenchStore = new WorkbenchStore(Promise.resolve(webcontainerInstance));

        if (import.meta.hot) {
          import.meta.hot.data.workbenchStore = workbenchStore;
        }

        await workbenchStore.init();

        if (disposed) {
          return;
        }

        setStore(workbenchStore);
      } catch (error) {
        console.error('Failed to initialize workbench store', error);
      }
    };

    createStore();

    return () => {
      disposed = true;
    };
  }, [store]);

  useEffect(() => {
    if (!store) {
      return;
    }

    shortcutsStore.setKey('toggleTerminal', {
      ...shortcutsStore.get().toggleTerminal,
      action: () => store.toggleTerminal(),
    });
  }, [store]);

  useEffect(() => {
    if (!store) {
      return undefined;
    }

    const unsubscribes = [
      actionEvents.onArtifactOpen((data) => {
        store.setShowWorkbench(true);
        store.addArtifact(data);
      }),
      actionEvents.onArtifactClose((data) => {
        store.updateArtifact(data, { closed: true });
      }),
      actionEvents.onActionOpen((data) => {
        if (data.action.type !== 'shell') {
          void store.addAction(data);
        }
      }),
      actionEvents.onActionClose((data) => {
        if (data.action.type === 'shell') {
          void store.addAction(data);
        }

        void store.runAction(data);
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [actionEvents, store]);

  const contextValue = useMemo(() => store, [store]);

  if (!contextValue) {
    return null;
  }

  return <WorkbenchContext.Provider value={contextValue}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchStore {
  const store = useContext(WorkbenchContext);

  if (!store) {
    throw new Error('useWorkbench must be used within a WorkbenchProvider');
  }

  return store;
}
