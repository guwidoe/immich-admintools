<script lang="ts">
  import type { QueueStatus } from '$lib/types';
  import { Alert, Badge, Icon } from '@immich/ui';
  import { mdiAlertCircle } from '@mdi/js';

  let { data } = $props<{ data: { queues: QueueStatus[]; error: string | null } }>();
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-dark-50 dark:text-dark-50 light:text-light-950">Queue Dashboard</h1>
      <p class="text-dark-400 dark:text-dark-400 light:text-light-600 mt-1">Monitor and manage Immich job queues</p>
    </div>
  </div>

  {#if data.error}
    <Alert color="danger">
      <div class="flex items-center gap-3">
        <Icon icon={mdiAlertCircle} size="20" />
        <span>{data.error}</span>
      </div>
    </Alert>
  {:else if data.queues.length === 0}
    <div class="card">
      <p class="text-dark-400 dark:text-dark-400 light:text-light-600">No queues available. Make sure the backend is connected to Immich.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each data.queues as queue}
        <a href="/queues/{encodeURIComponent(queue.name)}" class="card hover:border-primary transition-colors">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-dark-50 dark:text-dark-50 light:text-light-950">{queue.name}</h3>
            {#if queue.isPaused}
              <Badge color="warning">Paused</Badge>
            {:else}
              <Badge color="success">Active</Badge>
            {/if}
          </div>
          <div class="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Waiting</p>
              <p class="text-dark-50 dark:text-dark-50 light:text-light-950 font-medium">{queue.jobCounts.waiting}</p>
            </div>
            <div>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Active</p>
              <p class="text-dark-50 dark:text-dark-50 light:text-light-950 font-medium">{queue.jobCounts.active}</p>
            </div>
            <div>
              <p class="text-dark-400 dark:text-dark-400 light:text-light-600">Failed</p>
              <p class="font-medium {queue.jobCounts.failed > 0 ? 'text-danger-500' : 'text-dark-50 dark:text-dark-50 light:text-light-950'}">{queue.jobCounts.failed}</p>
            </div>
          </div>
          {#if queue.stuckJobs && queue.stuckJobs.length > 0}
            <div class="mt-3 pt-3 border-t border-dark-700 dark:border-dark-700 light:border-light-300">
              <p class="text-sm text-warning-500">
                {queue.stuckJobs.length} stuck job{queue.stuckJobs.length !== 1 ? 's' : ''}
              </p>
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
