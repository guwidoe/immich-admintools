export async function load({ fetch, params }) {
  const name = params.name;
  try {
    const response = await fetch(`/api/queues/${encodeURIComponent(name)}`);
    if (!response.ok) {
      return { queue: null, queueName: name, error: `HTTP ${response.status}` };
    }
    const queue = await response.json();
    return { queue, queueName: name, error: null };
  } catch (e) {
    return { queue: null, queueName: name, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
