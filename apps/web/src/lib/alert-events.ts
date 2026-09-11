export const pendingAlertCountChangedEvent =
  "casabella:pending-alert-count-changed";

export function notifyPendingAlertCountChanged(): void {
  window.dispatchEvent(new Event(pendingAlertCountChangedEvent));
}
