// Shared SSE client for /api/events/stream. Cookie auth flows automatically
// (same-origin EventSource). Reconnects with exponential backoff on drop and
// reports connection state so pages can show a live/offline indicator.
//
// Usage: const stream = connectPipelineStream({ onEvent, onStatus });

const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

function connectPipelineStream({ onEvent, onStatus = () => {} }) {
  let source = null;
  let backoff = BACKOFF_START_MS;
  let retryTimer = null;
  let closed = false;

  function open() {
    if (closed) return;
    onStatus('connecting');
    source = new EventSource('/api/events/stream');
    source.addEventListener('hello', () => {
      backoff = BACKOFF_START_MS;
      onStatus('live');
    });
    source.addEventListener('pipeline', (msg) => {
      let event;
      try { event = JSON.parse(msg.data); } catch { return; } // never let one bad frame kill the page
      onEvent(event);
    });
    source.onerror = () => {
      // EventSource retries by itself, but on auth failure / server restart it
      // can spin — take over with explicit backoff so the UI stays honest.
      source.close();
      probeAndRetry();
    };
  }

  // EventSource exposes no HTTP status, so probe the endpoint: a 401 means
  // this tab is not authorized and reconnecting can NEVER succeed — stop
  // retrying and report 'unauthorized' (pages show the auth banner on it).
  async function probeAndRetry() {
    if (closed) return;
    let unauthorized = false;
    try {
      const res = await fetch('/api/events/stream', { method: 'HEAD' });
      unauthorized = res.status === 401;
      res.body?.cancel?.();
    } catch { /* server unreachable — plain offline, keep backing off */ }
    if (closed) return;
    if (unauthorized) {
      closed = true;
      onStatus('unauthorized');
      return;
    }
    onStatus('offline');
    retryTimer = setTimeout(open, backoff);
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
  }

  open();
  return {
    close() {
      closed = true;
      clearTimeout(retryTimer);
      if (source) source.close();
    }
  };
}

window.connectPipelineStream = connectPipelineStream;
