<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { Alert, Button, Icon, LoadingSpinner } from '@immich/ui';
  import {
    mdiAccountMultiple,
    mdiCheckboxBlankOutline,
    mdiCheckboxMarked,
    mdiRefresh
  } from '@mdi/js';
  import type { Person, PersonCluster, MergeResult } from '$lib/types';
  import { mergePeople, fetchPeople } from '$lib/api/client';
  import PersonClusterCard from '$lib/components/PersonClusterCard.svelte';
  import MergeProgress from '$lib/components/MergeProgress.svelte';

  // State
  let thresholdInput = $state(80);
  let threshold = $state(80);
  let selectedClusterIds = $state<Set<string>>(new Set());
  let mergingClusterIds = $state<Set<string>>(new Set());
  let showProgress = $state(false);
  let mergeTotal = $state(0);
  let mergeCompleted = $state(0);
  let mergeResults = $state<MergeResult[]>([]);
  let loading = $state(true);
  let computing = $state(false);
  let error = $state<string | null>(null);
  let people = $state<Person[]>([]);
  let clusters = $state<PersonCluster[]>([]);

  // Web Worker for clustering
  let clusterWorker: Worker | null = null;

  // Debounce timer for threshold
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Derived from clusters (cheap operations)
  let allSelected = $derived(
    clusters.length > 0 && selectedClusterIds.size === clusters.length
  );
  let selectedCount = $derived(selectedClusterIds.size);
  let totalDuplicates = $derived(
    clusters.reduce((sum, c) => sum + c.people.length - 1, 0)
  );

  // Initialize worker on mount
  onMount(() => {
    clusterWorker = new Worker(
      new URL('$lib/workers/clusterWorker.ts', import.meta.url),
      { type: 'module' }
    );
    clusterWorker.onmessage = (e: MessageEvent<PersonCluster[]>) => {
      clusters = e.data;
      computing = false;
    };
    loadPeople();
  });

  onDestroy(() => {
    clusterWorker?.terminate();
  });

  // Debounced threshold change
  function handleThresholdChange(newValue: number) {
    thresholdInput = newValue;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      threshold = newValue;
      computeClusters();
    }, 300);
  }

  // Run clustering in Web Worker to keep UI responsive
  async function computeClusters() {
    if (people.length === 0) {
      clusters = [];
      return;
    }

    if (!clusterWorker) return;

    computing = true;
    await tick(); // Let UI update to show computing state

    // Send work to worker - clone data to ensure it's serializable
    // (Svelte's reactive state may contain non-cloneable properties)
    clusterWorker.postMessage({ people: JSON.parse(JSON.stringify(people)), threshold });
  }

  async function loadPeople() {
    loading = true;
    error = null;
    try {
      // First fetch people without counts (fast)
      const result = await fetchPeople(true, false);
      people = result;
      await tick();
      await computeClusters();
      loading = false;

      // Then fetch counts in background and update
      fetchPeople(true, true).then((peopleWithCounts) => {
        // Create a map for quick lookup
        const countMap = new Map(peopleWithCounts.map((p) => [p.id, p.assetCount]));
        // Update existing people with counts
        people = people.map((p) => ({ ...p, assetCount: countMap.get(p.id) }));
        // Also update clusters' people arrays
        clusters = clusters.map((c) => ({
          ...c,
          people: c.people.map((p) => ({ ...p, assetCount: countMap.get(p.id) }))
        }));
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to fetch people';
      loading = false;
    }
  }

  // Functions
  function toggleClusterSelection(clusterId: string) {
    const newSet = new Set(selectedClusterIds);
    if (newSet.has(clusterId)) {
      newSet.delete(clusterId);
    } else {
      newSet.add(clusterId);
    }
    selectedClusterIds = newSet;
  }

  function toggleSelectAll() {
    if (allSelected) {
      selectedClusterIds = new Set();
    } else {
      selectedClusterIds = new Set(clusters.map((c) => c.id));
    }
  }

  function changePrimary(clusterId: string, personId: string) {
    const clusterIndex = clusters.findIndex((c) => c.id === clusterId);
    if (clusterIndex === -1) return;
    clusters[clusterIndex].primaryId = personId;
  }

  async function mergeCluster(cluster: PersonCluster): Promise<MergeResult> {
    const idsToMerge = cluster.people
      .filter((p) => p.id !== cluster.primaryId)
      .map((p) => p.id);

    try {
      const results = await mergePeople(cluster.primaryId, idsToMerge);
      const allSuccess = results.every((r) => r.success);
      return {
        clusterId: cluster.id,
        results,
        success: allSuccess
      };
    } catch (err) {
      return {
        clusterId: cluster.id,
        results: idsToMerge.map((id) => ({
          id,
          success: false,
          error: 'UNKNOWN' as const
        })),
        success: false
      };
    }
  }

  // Update local state after a successful merge (avoids refetching/reclustering)
  function applyMergeToLocalState(cluster: PersonCluster) {
    const mergedIds = new Set(cluster.people.filter((p) => p.id !== cluster.primaryId).map((p) => p.id));

    // Update the primary person's asset count (sum of all merged people)
    const totalAssets = cluster.people.reduce((sum, p) => sum + (p.assetCount || 0), 0);

    // Update people: remove merged ones, update primary's count
    people = people
      .filter((p) => !mergedIds.has(p.id))
      .map((p) => (p.id === cluster.primaryId ? { ...p, assetCount: totalAssets } : p));

    // Remove the cluster from the list
    clusters = clusters.filter((c) => c.id !== cluster.id);

    // Clean up selection
    selectedClusterIds = new Set([...selectedClusterIds].filter((id) => id !== cluster.id));
  }

  async function handleMergeSingle(cluster: PersonCluster) {
    mergingClusterIds = new Set([...mergingClusterIds, cluster.id]);

    const result = await mergeCluster(cluster);

    mergingClusterIds = new Set([...mergingClusterIds].filter((id) => id !== cluster.id));

    if (result.success) {
      applyMergeToLocalState(cluster);
    } else {
      error = `Failed to merge cluster "${cluster.representativeName}"`;
    }
  }

  async function handleMergeSelected() {
    const clustersToMerge = clusters.filter((c) => selectedClusterIds.has(c.id));
    if (clustersToMerge.length === 0) return;

    showProgress = true;
    mergeTotal = clustersToMerge.length;
    mergeCompleted = 0;
    mergeResults = [];

    for (const cluster of clustersToMerge) {
      const result = await mergeCluster(cluster);
      mergeResults = [...mergeResults, result];
      mergeCompleted++;

      if (result.success) {
        applyMergeToLocalState(cluster);
      }
    }

    selectedClusterIds = new Set();
  }

  function closeProgress() {
    showProgress = false;
    mergeResults = [];
  }
</script>

<div class="space-y-6">
  <!-- Header section -->
  <div class="flex items-start justify-between">
    <div>
      <p class="text-gray-600 dark:text-gray-400">
        Find and merge duplicate person entries based on similar names.
      </p>
    </div>
    <Button size="small" onclick={loadPeople} disabled={loading}>
      <Icon icon={mdiRefresh} size="1.25em" class={loading ? 'animate-spin' : ''} />
      Refresh
    </Button>
  </div>

  {#if error}
    <Alert color="danger">
      {error}
    </Alert>
  {/if}

  <!-- Controls -->
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700">
    <div class="flex flex-wrap items-center gap-6">
      <!-- Threshold slider -->
      <div class="flex items-center gap-3">
        <label for="threshold" class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Similarity Threshold:
        </label>
        <input
          id="threshold"
          type="range"
          min="50"
          max="100"
          value={thresholdInput}
          oninput={(e) => handleThresholdChange(Number(e.currentTarget.value))}
          class="w-32 accent-immich-primary"
          disabled={loading}
        />
        <span class="text-sm font-mono text-gray-600 dark:text-gray-400 w-12">
          {thresholdInput}%
        </span>
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Icon icon={mdiAccountMultiple} size="1.25em" />
        {#if computing}
          <span>{people.length} people &middot; computing clusters...</span>
        {:else}
          <span>
            {people.length} people &middot; {clusters.length} clusters &middot; {totalDuplicates} potential
            duplicates
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Bulk actions -->
  {#if clusters.length > 0}
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-immich-primary dark:hover:text-immich-dark-primary"
        onclick={toggleSelectAll}
      >
        <Icon icon={allSelected ? mdiCheckboxMarked : mdiCheckboxBlankOutline} size="1.25em" />
        {allSelected ? 'Deselect All' : 'Select All'}
      </button>

      {#if selectedCount > 0}
        <Button color="primary" onclick={handleMergeSelected}>
          Merge Selected ({selectedCount})
        </Button>
      {/if}
    </div>
  {/if}

  <!-- Cluster list -->
  {#if loading || computing}
    <div class="flex flex-col items-center justify-center py-12 gap-3">
      <LoadingSpinner />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {loading ? 'Loading people...' : 'Finding similar names...'}
      </p>
    </div>
  {:else if clusters.length === 0}
    <div class="text-center py-12">
      <Icon icon={mdiAccountMultiple} size="3em" class="text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        No Duplicates Found
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {#if people.length === 0}
          No people found in your library.
        {:else}
          No people with similar names found at {thresholdInput}% threshold. Try lowering the threshold.
        {/if}
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each clusters as cluster (cluster.id)}
        <PersonClusterCard
          {cluster}
          selected={selectedClusterIds.has(cluster.id)}
          merging={mergingClusterIds.has(cluster.id)}
          onToggleSelect={() => toggleClusterSelection(cluster.id)}
          onPrimaryChange={(personId) => changePrimary(cluster.id, personId)}
          onMerge={() => handleMergeSingle(cluster)}
        />
      {/each}
    </div>
  {/if}
</div>

<!-- Merge progress modal -->
{#if showProgress}
  <MergeProgress
    total={mergeTotal}
    completed={mergeCompleted}
    results={mergeResults}
    onClose={closeProgress}
  />
{/if}
