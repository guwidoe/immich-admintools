<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { QueueStatus } from '$lib/types';
  import { pauseQueue, resumeQueue } from '$lib/api/client';

  let { data } = $props<{ data: { queue: QueueStatus | null; queueName: string; error: string | null } }>();
  let actionLoading = $state(false);
  let actionError = $state<string | null>(null);

  async function handlePauseResume() {
    if (!data.queue) return;
    actionLoading = true;
    actionError = null;
    try {
      if (data.queue.isPaused) {
        await resumeQueue(data.queueName);
      } else {
        await pauseQueue(data.queueName);
      }
      await invalidateAll();
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Action failed';
    } finally {
      actionLoading = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <a href="/" class="text-immich-dark-muted hover:text-white transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    </a>
    <div>
      <h1 class="text-2xl font-bold text-white">{data.queueName}</h1>
      <p class="text-immich-dark-muted mt-1">Queue details and management</p>
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
  {:else if data.queue}
    {#if actionError}
      <div class="card bg-red-900/20 border-red-800">
        <span class="text-red-400">{actionError}</span>
      </div>
    {/if}

    <!-- Queue Status Card -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-white">Status</h2>
          {#if data.queue.isPaused}
            <span class="px-2 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded">Paused</span>
          {:else}
            <span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">Active</span>
          {/if}
        </div>
        <button
          onclick={handlePauseResume}
          disabled={actionLoading}
          class="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 {data.queue.isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}"
        >
          {#if actionLoading}
            <span class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </span>
          {:else}
            {data.queue.isPaused ? 'Resume Queue' : 'Pause Queue'}
          {/if}
        </button>
      </div>

      <!-- Tracked Stats (persistent completion tracking) -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p class="text-green-400 text-sm font-medium">Jobs Completed</p>
          <p class="text-3xl font-bold text-green-400">{(data.queue.trackedStats?.completed ?? 0).toLocaleString()}</p>
          <p class="text-xs text-immich-dark-muted mt-1">Tracked since monitoring started</p>
        </div>
        <div class="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p class="text-red-400 text-sm font-medium">Jobs Failed</p>
          <p class="text-3xl font-bold text-red-400">{(data.queue.trackedStats?.failed ?? 0).toLocaleString()}</p>
          <p class="text-xs text-immich-dark-muted mt-1">Tracked since monitoring started</p>
        </div>
      </div>

      <!-- Current Queue State -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Waiting</p>
          <p class="text-2xl font-bold text-white">{data.queue.jobCounts.waiting.toLocaleString()}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Active</p>
          <p class="text-2xl font-bold text-white">{data.queue.jobCounts.active.toLocaleString()}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">In Queue (Failed)</p>
          <p class="text-2xl font-bold {data.queue.jobCounts.failed > 0 ? 'text-red-400' : 'text-white'}">{data.queue.jobCounts.failed.toLocaleString()}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Delayed</p>
          <p class="text-2xl font-bold text-white">{data.queue.jobCounts.delayed.toLocaleString()}</p>
        </div>
      </div>
    </div>

    <!-- Stuck Jobs Section -->
    {#if data.queue.stuckJobs && data.queue.stuckJobs.length > 0}
      <div class="card border-yellow-800 bg-yellow-900/10">
        <h2 class="text-lg font-semibold text-yellow-400 mb-4">
          Stuck Jobs ({data.queue.stuckJobs.length})
        </h2>
        <div class="space-y-2">
          {#each data.queue.stuckJobs as job}
            <div class="p-3 bg-immich-dark-bg rounded-lg flex items-center justify-between">
              <div>
                <p class="text-white font-mono text-sm">{job.jobId}</p>
                {#if job.assetPath}
                  <p class="text-immich-dark-muted text-xs mt-1">{job.assetPath}</p>
                {/if}
              </div>
              <div class="text-right">
                <p class="text-yellow-400 text-sm">{Math.round(job.ageSeconds / 60)} min</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Placeholder for future features -->
    <div class="card border-dashed">
      <p class="text-immich-dark-muted text-center">
        Additional queue management features coming soon...
      </p>
    </div>
  {:else}
    <div class="card">
      <p class="text-immich-dark-muted">Queue not found.</p>
    </div>
  {/if}
</div>
