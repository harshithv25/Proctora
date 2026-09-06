
interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

function createAppStore() {
  let isPageLoading = $state(true);
  let toasts = $state<Toast[]>([]);

  function setPageLoading(loading: boolean) {
    isPageLoading = loading;
  }

  function addToast(message: string, type: Toast['type'] = 'info') {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type }];

    setTimeout(() => removeToast(id), 4000);
  }

  function removeToast(id: string) {
    toasts = toasts.filter(t => t.id !== id);
  }

  return {
    get isPageLoading() { return isPageLoading; },
    get toasts()        { return toasts; },
    setPageLoading,
    addToast,
    removeToast,
  };
}

export const appStore = createAppStore();
