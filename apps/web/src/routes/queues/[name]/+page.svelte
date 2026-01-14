<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { QueueStatus } from '$lib/types';
  import { fetchQueue, pauseQueue, resumeQueue } from '$lib/api/client';

  let queueName = $derived(decodeURIComponent($page.params.name ?? ''));
  let queue: QueueStatus | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let actionLoading = $state(false);

  async function loadQueue() {
    loading = true;
    error = null;
    try {
      queue = await fetchQueue(queueName);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load queue';
    } finally {
      loading = false;
    }
  }

  async function handlePauseResume() {
    if (!queue) return;
    actionLoading = true;
    try {
      if (queue.isPaused) {
        await resumeQueue(queueName);
      } else {
        await pauseQueue(queueName);
      }
      await loadQueue();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Action failed';
    } finally {
      actionLoading = false;
    }
  }

  onMount(() => {
    loadQueue();
  });
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <a href="/" class="text-immich-dark-muted hover:text-white transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
    </a>
    <div>
      <h1 class="text-2xl font-bold text-white">{queueName}</h1>
      <p class="text-immich-dark-muted mt-1">Queue details and management</p>
    </div>
  </div>

  {#if loading}
    <div class="card">
      <div class="flex items-center gap-3">
        <div class="w-5 h-5 border-2 border-immich-primary border-t-transparent rounded-full animate-spin"></div>
        <span class="text-immich-dark-muted">Loading queue details...</span>
      </div>
    </div>
  {:else if error}
    <div class="card bg-red-900/20 border-red-800">
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-red-400">{error}</span>
      </div>
    </div>
  {:else if queue}
    <!-- Queue Status Card -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-white">Status</h2>
          {#if queue.isPaused}
            <span class="px-2 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded">Paused</span>
          {:else}
            <span class="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">Active</span>
          {/if}
        </div>
        <button
          onclick={handlePauseResume}
          disabled={actionLoading}
          class="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 {queue.isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}"
        >
          {#if actionLoading}
            <span class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </span>
          {:else}
            {queue.isPaused ? 'Resume Queue' : 'Pause Queue'}
          {/if}
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Waiting</p>
          <p class="text-2xl font-bold text-white">{queue.jobCounts.waiting}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Active</p>
          <p class="text-2xl font-bold text-white">{queue.jobCounts.active}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Failed</p>
          <p class="text-2xl font-bold {queue.jobCounts.failed > 0 ? 'text-red-400' : 'text-white'}">{queue.jobCounts.failed}</p>
        </div>
        <div class="p-4 bg-immich-dark-bg rounded-lg">
          <p class="text-immich-dark-muted text-sm">Delayed</p>
          <p class="text-2xl font-bold text-white">{queue.jobCounts.delayed}</p>
        </div>
      </div>
    </div>

    <!-- Stuck Jobs Section -->
    {#if queue.stuckJobs && queue.stuckJobs.length > 0}
      <div class="card border-yellow-800 bg-yellow-900/10">
        <h2 class="text-lg font-semibold text-yellow-400 mb-4">
          Stuck Jobs ({queue.stuckJobs.length})
        </h2>
        <div class="space-y-2">
          {#each queue.stuckJobs as job}
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
  {/if}
</div>
