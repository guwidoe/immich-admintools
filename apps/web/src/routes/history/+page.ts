import type { PageLoad } from './$types';
import type { AllTrackedStats } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    const stats: AllTrackedStats = await response.json();
    return { stats, error: null };
  } catch (err) {
    return {
      stats: {} as AllTrackedStats,
      error: err instanceof Error ? err.message : 'Failed to load stats'
    };
  }
};
