export async function load({ fetch }) {
  try {
    const response = await fetch('/api/queues');
    if (!response.ok) {
      return { queues: [], error: `HTTP ${response.status}` };
    }
    const queues = await response.json();
    return { queues, error: null };
  } catch (e) {
    return { queues: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
