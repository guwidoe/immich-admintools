<script lang="ts">
  import type { QueueStatus } from '$lib/types';

  let { data } = $props<{ data: { queues: QueueStatus[]; error: string | null } }>();
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Queue Dashboard</h1>
      <p class="text-immich-dark-muted mt-1">Monitor and manage Immich job queues</p>
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
  {:else if data.queues.length === 0}
    <div class="card">
      <p class="text-immich-dark-muted">No queues available. Make sure the backend is connected to Immich.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each data.queues as queue}
        <a href="/queues/{encodeURIComponent(queue.name)}" class="card hover:border-immich-primary transition-colors">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-white">{queue.name}</h3>
            {#if queue.isPaused}
              <span class="px-2 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded">Paused</span>
            {:else}
              <span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">Active</span>
            {/if}
          </div>
          <div class="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p class="text-immich-dark-muted">Waiting</p>
              <p class="text-white font-medium">{queue.jobCounts.waiting}</p>
            </div>
            <div>
              <p class="text-immich-dark-muted">Active</p>
              <p class="text-white font-medium">{queue.jobCounts.active}</p>
            </div>
            <div>
              <p class="text-immich-dark-muted">Failed</p>
              <p class="text-white font-medium {queue.jobCounts.failed > 0 ? 'text-red-400' : ''}">{queue.jobCounts.failed}</p>
            </div>
          </div>
          {#if queue.stuckJobs && queue.stuckJobs.length > 0}
            <div class="mt-3 pt-3 border-t border-immich-dark-border">
              <p class="text-sm text-yellow-400">
                {queue.stuckJobs.length} stuck job{queue.stuckJobs.length !== 1 ? 's' : ''}
              </p>
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
