<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { AllTrackedStats, TrackedQueueStats } from '$lib/types';
  import { resetStats } from '$lib/api/client';

  let { data } = $props<{ data: { stats: AllTrackedStats; error: string | null } }>();
  let resetLoading = $state(false);

  // Calculate totals
  let totalCompleted = $derived(
    (Object.values(data.stats) as TrackedQueueStats[]).reduce((sum, s) => sum + s.completed, 0)
  );
  let totalFailed = $derived(
    (Object.values(data.stats) as TrackedQueueStats[]).reduce((sum, s) => sum + s.failed, 0)
  );

  // Get queues with activity, sorted by completed desc
  let activeQueues = $derived(
    (Object.entries(data.stats) as [string, TrackedQueueStats][])
      .filter(([_, s]) => s.completed > 0 || s.failed > 0)
      .sort((a, b) => b[1].completed - a[1].completed)
  );

  // Get most recent update
  let lastUpdated = $derived(() => {
    const updates = (Object.values(data.stats) as TrackedQueueStats[])
      .map((s) => s.lastUpdated)
      .filter((d): d is string => d !== null)
      .map((d) => new Date(d));
    if (updates.length === 0) return null;
    return new Date(Math.max(...updates.map((d) => d.getTime())));
  });

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  async function handleResetAll() {
    if (!confirm('Are you sure you want to reset all tracked stats? This cannot be undone.')) {
      return;
    }
    resetLoading = true;
    try {
      await resetStats();
      await invalidateAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset stats');
    } finally {
      resetLoading = false;
    }
  }

  async function handleResetQueue(queueName: string) {
    if (!confirm(`Reset stats for ${queueName}?`)) {
      return;
    }
    try {
      await resetStats(queueName);
      await invalidateAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset stats');
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Job History</h1>
      <p class="text-immich-dark-muted mt-1">View completed and failed job history</p>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={() => invalidateAll()}
        class="px-3 py-2 text-sm bg-immich-dark-card rounded-lg hover:bg-immich-dark-border flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
      <button
        onclick={handleResetAll}
        disabled={resetLoading}
        class="px-3 py-2 text-sm bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900/70 disabled:opacity-50"
      >
        Reset All
      </button>
    </div>
  </div>

  {#if data.error}
    <div class="card bg-red-900/20 border-red-800">
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-red-400">{data.error}</span>
      </div>
    </div>
  {/if}

  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="card">
      <h3 class="text-white font-medium mb-2">Completed Jobs</h3>
      <p class="text-3xl font-bold text-green-400">{totalCompleted.toLocaleString()}</p>
      <p class="text-immich-dark-muted text-sm">Since monitoring started</p>
    </div>
    <div class="card">
      <h3 class="text-white font-medium mb-2">Failed Jobs</h3>
      <p class="text-3xl font-bold text-red-400">{totalFailed.toLocaleString()}</p>
      <p class="text-immich-dark-muted text-sm">Since monitoring started</p>
    </div>
    <div class="card">
      <h3 class="text-white font-medium mb-2">Success Rate</h3>
      <p class="text-3xl font-bold text-white">
        {#if totalCompleted + totalFailed > 0}
          {((totalCompleted / (totalCompleted + totalFailed)) * 100).toFixed(1)}%
        {:else}
          --
        {/if}
      </p>
      <p class="text-immich-dark-muted text-sm">Overall</p>
    </div>
  </div>

  <!-- Per-Queue Stats -->
  <div class="card">
    <h2 class="text-lg font-semibold text-white mb-4">Stats by Queue</h2>

    {#if activeQueues.length === 0}
      <div class="text-center py-8 text-immich-dark-muted">
        <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>No job activity tracked yet.</p>
        <p class="text-sm mt-1">Stats will appear here once jobs start completing.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-immich-dark-muted text-sm border-b border-immich-dark-border">
              <th class="pb-3 font-medium">Queue</th>
              <th class="pb-3 font-medium text-right">Completed</th>
              <th class="pb-3 font-medium text-right">Failed</th>
              <th class="pb-3 font-medium text-right">Success Rate</th>
              <th class="pb-3 font-medium text-right">Last Activity</th>
              <th class="pb-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-immich-dark-border">
            {#each activeQueues as [queueName, stats]}
              {@const successRate = stats.completed + stats.failed > 0
                ? ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1)
                : '--'}
              <tr class="hover:bg-immich-dark-bg/50">
                <td class="py-3">
                  <a href="/queues/{encodeURIComponent(queueName)}" class="text-white hover:text-immich-primary">
                    {queueName}
                  </a>
                </td>
                <td class="py-3 text-right text-green-400 font-mono">
                  {stats.completed.toLocaleString()}
                </td>
                <td class="py-3 text-right text-red-400 font-mono">
                  {stats.failed.toLocaleString()}
                </td>
                <td class="py-3 text-right">
                  <span class="{parseFloat(successRate) >= 95 ? 'text-green-400' : parseFloat(successRate) >= 80 ? 'text-yellow-400' : 'text-red-400'}">
                    {successRate}{successRate !== '--' ? '%' : ''}
                  </span>
                </td>
                <td class="py-3 text-right text-immich-dark-muted text-sm">
                  {formatDate(stats.lastUpdated)}
                </td>
                <td class="py-3 text-right">
                  <button
                    onclick={() => handleResetQueue(queueName)}
                    class="text-xs text-red-400 hover:text-red-300"
                  >
                    Reset
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
