<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { AllTrackedStats, TrackedQueueStats } from '$lib/types';
  import { resetStats } from '$lib/api/client';
  import { Alert, Button, Card, CardBody, Icon } from '@immich/ui';
  import { mdiRefresh, mdiAlertCircle, mdiChartBar } from '@mdi/js';

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
      <h1 class="text-2xl font-bold text-dark-50">Job History</h1>
      <p class="text-dark-400 mt-1">View completed and failed job history</p>
    </div>
    <div class="flex items-center gap-2">
      <Button size="small" variant="ghost" onclick={() => invalidateAll()}>
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

  {#if data.error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>{data.error}</span>
      </div>
    </Alert>
  {/if}

  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-medium mb-2">Completed Jobs</h3>
        <p class="text-3xl font-bold text-success-500">{totalCompleted.toLocaleString()}</p>
        <p class="text-dark-400 text-sm">Since monitoring started</p>
      </CardBody>
    </Card>
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-medium mb-2">Failed Jobs</h3>
        <p class="text-3xl font-bold text-danger-500">{totalFailed.toLocaleString()}</p>
        <p class="text-dark-400 text-sm">Since monitoring started</p>
      </CardBody>
    </Card>
    <Card>
      <CardBody>
        <h3 class="text-dark-50 font-medium mb-2">Success Rate</h3>
        <p class="text-3xl font-bold text-dark-50">
          {#if totalCompleted + totalFailed > 0}
            {((totalCompleted / (totalCompleted + totalFailed)) * 100).toFixed(1)}%
          {:else}
            --
          {/if}
        </p>
        <p class="text-dark-400 text-sm">Overall</p>
      </CardBody>
    </Card>
  </div>

  <!-- Per-Queue Stats -->
  <Card>
    <CardBody>
      <h2 class="text-lg font-semibold text-dark-50 mb-4">Stats by Queue</h2>

      {#if activeQueues.length === 0}
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
              {#each activeQueues as [queueName, stats]}
                {@const successRate = stats.completed + stats.failed > 0
                  ? ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1)
                  : '--'}
                <tr class="hover:bg-dark-800/50">
                  <td class="py-3">
                    <a href="/queues/{encodeURIComponent(queueName)}" class="text-dark-50 hover:text-primary-400">
                      {queueName}
                    </a>
                  </td>
                  <td class="py-3 text-right text-success-500 font-mono">
                    {stats.completed.toLocaleString()}
                  </td>
                  <td class="py-3 text-right text-danger-500 font-mono">
                    {stats.failed.toLocaleString()}
                  </td>
                  <td class="py-3 text-right">
                    <span class="{parseFloat(successRate) >= 95 ? 'text-success-500' : parseFloat(successRate) >= 80 ? 'text-warning-500' : 'text-danger-500'}">
                      {successRate}{successRate !== '--' ? '%' : ''}
                    </span>
                  </td>
                  <td class="py-3 text-right text-dark-400 text-sm">
                    {formatDate(stats.lastUpdated)}
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
