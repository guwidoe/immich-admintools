import { writable, derived } from 'svelte/store';
import type { HealthStatus } from '$lib/types';
import { fetchHealth } from '$lib/api/client';

interface ConnectionState {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

const initialState: ConnectionState = {
  health: null,
  loading: false,
  error: null,
  lastChecked: null
};

function createConnectionStore() {
  const { subscribe, set, update } = writable<ConnectionState>(initialState);

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function checkHealth() {
    update((state) => ({ ...state, loading: true, error: null }));

    try {
      const health = await fetchHealth();
      update((state) => ({
        ...state,
        health,
        loading: false,
        lastChecked: new Date()
      }));
    } catch (err) {
      update((state) => ({
        ...state,
        health: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Connection failed'
      }));
    }
  }

  function startPolling(intervalMs = 30000) {
    stopPolling();
    checkHealth();
    pollInterval = setInterval(checkHealth, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return {
    subscribe,
    checkHealth,
    startPolling,
    stopPolling,
    reset: () => set(initialState)
  };
}

export const connectionStore = createConnectionStore();

export const isConnected = derived(connectionStore, ($connection) => {
  return $connection.health?.status === 'ok';
});

export const connectionStatus = derived(connectionStore, ($connection) => {
  if ($connection.loading) return 'checking';
  if ($connection.error) return 'error';
  if (!$connection.health) return 'unknown';
  return $connection.health.status;
});
