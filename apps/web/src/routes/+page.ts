import type { AppSettings } from '$lib/api/client';

export async function load({ fetch }) {
  try {
    const [queuesResponse, settingsResponse] = await Promise.all([
      fetch('/api/queues'),
      fetch('/api/settings')
    ]);

    const queues = queuesResponse.ok ? await queuesResponse.json() : [];
    const settings: AppSettings | null = settingsResponse.ok ? await settingsResponse.json() : null;

    return {
      queues,
      settings,
      error: queuesResponse.ok ? null : `HTTP ${queuesResponse.status}`
    };
  } catch (e) {
    return {
      queues: [],
      settings: null,
      error: e instanceof Error ? e.message : 'Unknown error'
    };
  }
}
