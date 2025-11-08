import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { shortcutsStore } from '~/lib/stores/settings';
import { webcontainer } from '~/lib/webcontainer';
import { WorkbenchStore } from './index';

const WorkbenchContext = createContext<WorkbenchStore | null>(null);

export function WorkbenchProvider({ children }: PropsWithChildren): JSX.Element | null {
  const [store, setStore] = useState<WorkbenchStore | null>(() => {
    return (import.meta.hot?.data.workbenchStore as WorkbenchStore | undefined) ?? null;
  });

  useEffect(() => {
    if (store) {
      void store.init().catch((error) => {
        console.error('Failed to initialize workbench store', error);
      });
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

        if (disposed) {
          return;
        }

        setStore(workbenchStore);

        void workbenchStore.init().catch((error) => {
          console.error('Failed to initialize workbench store', error);
        });
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
