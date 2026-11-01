/** Fire-and-forget toast; rendered by components/toaster.jsx. */
export function toast(message) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app:toast', { detail: message }));
}
