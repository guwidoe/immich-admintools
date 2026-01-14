export async function load({ fetch }) {
  try {
    const response = await fetch('/api/health/settings');
    if (!response.ok) {
      return { settings: null, error: `HTTP ${response.status}` };
    }
    const settings = await response.json();
    return { settings, error: null };
  } catch (e) {
    return { settings: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
