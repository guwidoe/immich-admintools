<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { Alert, Button, Icon, LoadingSpinner } from '@immich/ui';
  import {
    mdiAccountMultiple,
    mdiCheckboxBlankOutline,
    mdiCheckboxMarked,
    mdiRefresh,
    mdiDownload
  } from '@mdi/js';
  import type { Person, PersonCluster, MergeResult } from '$lib/types';
  import { mergePeople, fetchPeople, fetchPeopleWithProgress } from '$lib/api/client';
  import { peopleStore } from '$lib/stores/peopleStore';
  import PersonClusterCard from '$lib/components/PersonClusterCard.svelte';
  import MergeProgress from '$lib/components/MergeProgress.svelte';
  import FacePreviewModal from '$lib/components/FacePreviewModal.svelte';

  // State
  let thresholdInput = $state(80);
  let threshold = $state(80);
  let selectedClusterIds = $state<Set<string>>(new Set());
  let mergingClusterIds = $state<Set<string>>(new Set());
  // Track which people are selected for merging within each cluster
  // Map<clusterId, Set<personId>> - defaults to all people selected
  let clusterPersonSelections = $state<Map<string, Set<string>>>(new Map());
  let showProgress = $state(false);
  let mergeTotal = $state(0);
  let mergeCompleted = $state(0);
  let mergeResults = $state<MergeResult[]>([]);
  let loading = $state(false);
  let loadingStatus = $state('Connecting to server...');
  let fetchProgress = $state(0); // 0-100 percentage for fetching
  let computing = $state(false);
  let computeProgress = $state(0); // 0-100 percentage for computing
  let error = $state<string | null>(null);
  let people = $state<Person[]>([]);
  let clusters = $state<PersonCluster[]>([]);
  let hasFetched = $state(false);
  let facePreviewPerson = $state<Person | null>(null);

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
    clusterWorker.onmessage = (e: MessageEvent<{ type: string; clusters?: PersonCluster[]; current?: number; total?: number }>) => {
      const msg = e.data;
      if (msg.type === 'progress' && msg.current !== undefined && msg.total !== undefined) {
        computeProgress = Math.round((msg.current / msg.total) * 100);
      } else if (msg.type === 'result' && msg.clusters) {
        // Set to 100% first and wait for animation before hiding
        computeProgress = 100;
        setTimeout(() => {
          clusters = msg.clusters!;
          // Initialize person selections - default all people selected per cluster
          const newSelections = new Map<string, Set<string>>();
          for (const cluster of msg.clusters!) {
            newSelections.set(cluster.id, new Set(cluster.people.map((p) => p.id)));
          }
          clusterPersonSelections = newSelections;
          computing = false;
        }, 200);
      }
    };

    // Check if we have cached data
    const cached = get(peopleStore);
    if (cached.threshold !== threshold) {
      threshold = cached.threshold;
      thresholdInput = cached.threshold;
    }
    if (cached.hasFetched && cached.people.length > 0) {
      people = cached.people;
      hasFetched = true;
      // Recompute clusters with cached data
      computeClusters();
    }
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
      peopleStore.setThreshold(newValue);
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
    computeProgress = 0;
    // Clear selections when recalculating clusters since cluster IDs will change
    selectedClusterIds = new Set();
    await tick(); // Let UI update to show computing state

    // Send work to worker - clone data to ensure it's serializable
    // (Svelte's reactive state may contain non-cloneable properties)
    clusterWorker.postMessage({ people: JSON.parse(JSON.stringify(people)), threshold });
  }

  async function loadPeople() {
    loading = true;
    loadingStatus = 'Fetching people from Immich...';
    fetchProgress = 0;
    error = null;
    try {
      // Fetch people with progress streaming
      const result = await fetchPeopleWithProgress(true, (progress) => {
        fetchProgress = Math.round((progress.loaded / progress.total) * 100);
        loadingStatus = `Fetching people... ${progress.loaded.toLocaleString()} / ${progress.total.toLocaleString()}`;
      });
      console.log('[People] Fetched', result.length, 'people from API');
      people = result;
      hasFetched = true;
      fetchProgress = 100;

      // Save to store for caching
      peopleStore.setPeople(result);

      loadingStatus = `Analyzing ${result.length.toLocaleString()} people for similar names...`;
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
        // Update store with counts
        peopleStore.setPeople(people);
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
    // Ensure the new primary is selected
    const currentSelection = clusterPersonSelections.get(clusterId);
    if (currentSelection && !currentSelection.has(personId)) {
      const newSelection = new Set(currentSelection);
      newSelection.add(personId);
      const newMap = new Map(clusterPersonSelections);
      newMap.set(clusterId, newSelection);
      clusterPersonSelections = newMap;
    }
  }

  function togglePersonSelection(clusterId: string, personId: string) {
    const currentSelection = clusterPersonSelections.get(clusterId);
    if (!currentSelection) return;

    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return;

    const newSelection = new Set(currentSelection);
    if (newSelection.has(personId)) {
      // Don't allow deselecting if it would leave less than 2 people
      if (newSelection.size <= 2) return;
      // Don't allow deselecting the primary - user must change primary first
      if (personId === cluster.primaryId) return;
      newSelection.delete(personId);
    } else {
      newSelection.add(personId);
    }

    const newMap = new Map(clusterPersonSelections);
    newMap.set(clusterId, newSelection);
    clusterPersonSelections = newMap;
  }

  function getSelectedPeopleForCluster(clusterId: string): Set<string> {
    return clusterPersonSelections.get(clusterId) || new Set();
  }

  async function mergeCluster(cluster: PersonCluster): Promise<MergeResult> {
    const selectedPeople = clusterPersonSelections.get(cluster.id) || new Set(cluster.people.map((p) => p.id));
    // Only merge selected people (excluding the primary)
    const idsToMerge = cluster.people
      .filter((p) => p.id !== cluster.primaryId && selectedPeople.has(p.id))
      .map((p) => p.id);

    if (idsToMerge.length === 0) {
      return {
        clusterId: cluster.id,
        results: [],
        success: true
      };
    }

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
    const selectedPeople = clusterPersonSelections.get(cluster.id) || new Set(cluster.people.map((p) => p.id));
    // Only count people that were actually merged (selected and not primary)
    const mergedIds = new Set(cluster.people.filter((p) => p.id !== cluster.primaryId && selectedPeople.has(p.id)).map((p) => p.id));

    // Update the primary person's asset count (sum of primary + merged people)
    const primary = cluster.people.find((p) => p.id === cluster.primaryId);
    const totalAssets = (primary?.assetCount || 0) +
      cluster.people
        .filter((p) => mergedIds.has(p.id))
        .reduce((sum, p) => sum + (p.assetCount || 0), 0);

    // Update people: remove merged ones, update primary's count
    people = people
      .filter((p) => !mergedIds.has(p.id))
      .map((p) => (p.id === cluster.primaryId ? { ...p, assetCount: totalAssets } : p));

    // Update the store as well
    peopleStore.setPeople(people);

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
    {#if hasFetched}
      <Button size="small" onclick={loadPeople} disabled={loading}>
        <Icon icon={mdiRefresh} size="1.25em" class={loading ? 'animate-spin' : ''} />
        Refresh
      </Button>
    {/if}
  </div>

  {#if error}
    <Alert color="danger">
      {error}
    </Alert>
  {/if}

  <!-- Initial fetch state -->
  {#if !hasFetched && !loading}
    <div class="flex flex-col items-center justify-center py-16 gap-6">
      <Icon icon={mdiAccountMultiple} size="4em" class="text-gray-400" />
      <div class="text-center space-y-2">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Load People from Immich
        </h3>
        <p class="text-gray-600 dark:text-gray-400 max-w-md">
          Fetch all people from your Immich library to find and merge duplicates with similar names.
        </p>
      </div>
      <Button color="primary" size="large" onclick={loadPeople}>
        <Icon icon={mdiDownload} size="1.25em" />
        Fetch People
      </Button>
    </div>
  {:else if loading}
    <!-- Loading state -->
    <div class="flex flex-col items-center justify-center py-12 gap-4">
      <LoadingSpinner />
      <div class="text-center space-y-2">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {loadingStatus}
        </p>
        {#if fetchProgress === 0}
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Connecting to server...
          </p>
        {/if}
      </div>
      <!-- Progress bar -->
      <div class="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-immich-primary rounded-full transition-all duration-150"
          style="width: {fetchProgress}%"
        ></div>
      </div>
    </div>
  {:else}
    <!-- Controls (only show after fetch) -->
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
            disabled={computing}
          />
          <span class="text-sm font-mono text-gray-600 dark:text-gray-400 w-12">
            {thresholdInput}%
          </span>
        </div>

        <!-- Stats -->
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Icon icon={mdiAccountMultiple} size="1.25em" />
          {#if computing}
            <span>{people.length.toLocaleString()} people &middot; computing clusters...</span>
          {:else}
            <span>
              {people.length.toLocaleString()} people &middot; {clusters.length} clusters &middot; {totalDuplicates} potential
              duplicates
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Bulk actions -->
    {#if clusters.length > 0 && !computing}
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
    {#if computing}
      <div class="flex flex-col items-center justify-center py-12 gap-4">
        <LoadingSpinner />
        <div class="text-center space-y-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Comparing names... {computeProgress}%
          </p>
        </div>
        <!-- Progress bar -->
        <div class="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-immich-primary rounded-full transition-all duration-150"
            style="width: {computeProgress}%"
          ></div>
        </div>
      </div>
    {:else if clusters.length === 0}
      <div class="text-center py-12">
        <Icon icon={mdiAccountMultiple} size="3em" class="text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No Duplicates Found
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          No people with similar names found at {thresholdInput}% threshold. Try lowering the threshold.
        </p>
      </div>
    {:else}
      <div class="space-y-4">
        {#each clusters as cluster (cluster.id)}
          <PersonClusterCard
            {cluster}
            selected={selectedClusterIds.has(cluster.id)}
            merging={mergingClusterIds.has(cluster.id)}
            selectedPeopleIds={getSelectedPeopleForCluster(cluster.id)}
            onToggleSelect={() => toggleClusterSelection(cluster.id)}
            onPrimaryChange={(personId) => changePrimary(cluster.id, personId)}
            onTogglePersonSelection={(personId) => togglePersonSelection(cluster.id, personId)}
            onMerge={() => handleMergeSingle(cluster)}
            onViewFaces={(person) => (facePreviewPerson = person)}
          />
        {/each}
      </div>
    {/if}
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

<!-- Face preview modal -->
{#if facePreviewPerson}
  <FacePreviewModal
    person={facePreviewPerson}
    onClose={() => (facePreviewPerson = null)}
  />
{/if}

