<script lang="ts">
  import { onMount } from 'svelte';
  import type { AllTrackedStats, TrackedQueueStats } from '$lib/types';
  import { resetStats } from '$lib/api/client';
  import { Alert, Button, Card, CardBody, Icon } from '@immich/ui';
  import { mdiRefresh, mdiAlertCircle, mdiChartBar } from '@mdi/js';

  let loading = $state(true);
  let error = $state<string | null>(null);
  let stats = $state<AllTrackedStats>({});
  let resetLoading = $state(false);

  async function loadStats() {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      stats = await response.json();
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load stats';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadStats();
  });

  // Calculate totals
  let totalCompleted = $derived(
    (Object.values(stats) as TrackedQueueStats[]).reduce((sum, s) => sum + s.completed, 0)
  );
  let totalFailed = $derived(
    (Object.values(stats) as TrackedQueueStats[]).reduce((sum, s) => sum + s.failed, 0)
  );

  // Get queues with activity, sorted by completed desc
  let activeQueues = $derived(
    (Object.entries(stats) as [string, TrackedQueueStats][])
      .filter(([_, s]) => s.completed > 0 || s.failed > 0)
      .sort((a, b) => b[1].completed - a[1].completed)
  );

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  async function handleRefresh() {
    loading = true;
    await loadStats();
  }

  async function handleResetAll() {
    if (!confirm('Are you sure you want to reset all tracked stats? This cannot be undone.')) {
      return;
    }
    resetLoading = true;
    try {
      await resetStats();
      await loadStats();
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
      await loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset stats');
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-dark-50">Job History</h1>
      <p class="text-dark-400 mt-1">View completed and failed job history</p>
    </div>
    <div class="flex items-center gap-2">
      <Button size="small" variant="ghost" onclick={handleRefresh} disabled={loading}>
        <Icon icon={mdiRefresh} size="16" />
        Refresh
      </Button>
      <Button
        size="small"
        color="danger"
        variant="outline"
        onclick={handleResetAll}
        loading={resetLoading}
      >
        Reset All
      </Button>
    </div>
  </div>

  {#if error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>{error}</span>
      </div>
    </Alert>
  {/if}

  <!-- Summary Cards - always render structure -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-medium mb-2">Completed Jobs</h3>
        {#if loading}
          <p class="text-3xl font-bold text-dark-400">--</p>
        {:else}
          <p class="text-3xl font-bold text-success-500">{totalCompleted.toLocaleString()}</p>
        {/if}
        <p class="text-dark-400 text-sm">Since monitoring started</p>
      </CardBody>
    </Card>
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-medium mb-2">Failed Jobs</h3>
        {#if loading}
          <p class="text-3xl font-bold text-dark-400">--</p>
        {:else}
          <p class="text-3xl font-bold text-danger-500">{totalFailed.toLocaleString()}</p>
        {/if}
        <p class="text-dark-400 text-sm">Since monitoring started</p>
      </CardBody>
    </Card>
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-medium mb-2">Success Rate</h3>
        <p class="text-3xl font-bold text-dark-50">
          {#if loading}
            --
          {:else if totalCompleted + totalFailed > 0}
            {((totalCompleted / (totalCompleted + totalFailed)) * 100).toFixed(1)}%
          {:else}
            --
          {/if}
        </p>
        <p class="text-dark-400 text-sm">Overall</p>
      </CardBody>
    </Card>
  </div>

  <!-- Per-Queue Stats - always render structure -->
  <Card>
    <CardBody>
      <h2 class="text-lg font-semibold text-dark-50 mb-4">Stats by Queue</h2>

      {#if loading}
        <!-- Skeleton rows while loading -->
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left text-dark-400 text-sm border-b border-dark-700">
                <th class="pb-3 font-medium">Queue</th>
                <th class="pb-3 font-medium text-right">Completed</th>
                <th class="pb-3 font-medium text-right">Failed</th>
                <th class="pb-3 font-medium text-right">Success Rate</th>
                <th class="pb-3 font-medium text-right">Last Activity</th>
                <th class="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-700">
              {#each [1, 2, 3, 4] as _}
                <tr class="animate-pulse">
                  <td class="py-3"><div class="h-4 w-32 bg-dark-700 rounded"></div></td>
                  <td class="py-3 text-right"><div class="h-4 w-16 bg-dark-700 rounded ml-auto"></div></td>
                  <td class="py-3 text-right"><div class="h-4 w-12 bg-dark-700 rounded ml-auto"></div></td>
                  <td class="py-3 text-right"><div class="h-4 w-14 bg-dark-700 rounded ml-auto"></div></td>
                  <td class="py-3 text-right"><div class="h-4 w-28 bg-dark-700 rounded ml-auto"></div></td>
                  <td class="py-3 text-right"><div class="h-4 w-10 bg-dark-700 rounded ml-auto"></div></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if activeQueues.length === 0}
        <div class="text-center py-8 text-dark-400">
          <Icon icon={mdiChartBar} size="48" class="mx-auto mb-4 opacity-50" />
          <p>No job activity tracked yet.</p>
          <p class="text-sm mt-1">Stats will appear here once jobs start completing.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left text-dark-400 text-sm border-b border-dark-700">
                <th class="pb-3 font-medium">Queue</th>
                <th class="pb-3 font-medium text-right">Completed</th>
                <th class="pb-3 font-medium text-right">Failed</th>
                <th class="pb-3 font-medium text-right">Success Rate</th>
                <th class="pb-3 font-medium text-right">Last Activity</th>
                <th class="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-700">
              {#each activeQueues as [queueName, queueStats]}
                {@const successRate = queueStats.completed + queueStats.failed > 0
                  ? ((queueStats.completed / (queueStats.completed + queueStats.failed)) * 100).toFixed(1)
                  : '--'}
                <tr class="hover:bg-dark-800/50">
                  <td class="py-3">
                    <a href="/queues/{encodeURIComponent(queueName)}" class="text-dark-50 hover:text-primary-400">
                      {queueName}
                    </a>
                  </td>
                  <td class="py-3 text-right text-success-500 font-mono">
                    {queueStats.completed.toLocaleString()}
                  </td>
                  <td class="py-3 text-right text-danger-500 font-mono">
                    {queueStats.failed.toLocaleString()}
                  </td>
                  <td class="py-3 text-right">
                    <span class="{parseFloat(successRate) >= 95 ? 'text-success-500' : parseFloat(successRate) >= 80 ? 'text-warning-500' : 'text-danger-500'}">
                      {successRate}{successRate !== '--' ? '%' : ''}
                    </span>
                  </td>
                  <td class="py-3 text-right text-dark-400 text-sm">
                    {formatDate(queueStats.lastUpdated)}
                  </td>
                  <td class="py-3 text-right">
                    <button
                      onclick={() => handleResetQueue(queueName)}
                      class="text-xs text-danger-500 hover:text-danger-400"
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
    </CardBody>
  </Card>
</div>
