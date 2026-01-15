<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Icon, LoadingSpinner } from '@immich/ui';
  import {
    mdiClose,
    mdiMagnifyPlus,
    mdiMagnifyMinus,
    mdiChevronDown,
    mdiImageMultiple
  } from '@mdi/js';
  import type { Person, FaceWithAsset } from '$lib/types';
  import { fetchPersonFaces, getAssetThumbnailUrl } from '$lib/api/client';

  interface Props {
    person: Person;
    onClose: () => void;
  }

  let { person, onClose }: Props = $props();

  let faces = $state<FaceWithAsset[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let thumbnailSize = $state<'small' | 'large'>('small');
  let showCount = $state(12);

  const LOAD_MORE_INCREMENT = 12;

  let visibleFaces = $derived(faces.slice(0, showCount));
  let remainingCount = $derived(Math.max(0, faces.length - showCount));

  onMount(async () => {
    try {
      faces = await fetchPersonFaces(person.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load faces';
    } finally {
      loading = false;
    }
  });

  function loadMore() {
    showCount += LOAD_MORE_INCREMENT;
  }

  function toggleSize() {
    thumbnailSize = thumbnailSize === 'small' ? 'large' : 'small';
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <!-- Modal content -->
  <div
    class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
      <div class="flex items-center gap-3">
        <Icon icon={mdiImageMultiple} size="1.5em" class="text-immich-primary dark:text-immich-dark-primary" />
        <div>
          <h2 id="modal-title" class="text-lg font-semibold text-gray-900 dark:text-white">
            {person.name || 'Unknown Person'}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {faces.length} {faces.length === 1 ? 'face' : 'faces'} found
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button size="small" color="secondary" onclick={toggleSize}>
          <Icon icon={thumbnailSize === 'small' ? mdiMagnifyPlus : mdiMagnifyMinus} size="1.25em" />
          {thumbnailSize === 'small' ? 'Larger' : 'Smaller'}
        </Button>
        <button
          type="button"
          class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          onclick={onClose}
          aria-label="Close"
        >
          <Icon icon={mdiClose} size="1.5em" />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-12 gap-4">
          <LoadingSpinner />
          <p class="text-sm text-gray-600 dark:text-gray-400">Loading faces...</p>
        </div>
      {:else if error}
        <div class="text-center py-12">
          <p class="text-red-500">{error}</p>
        </div>
      {:else if faces.length === 0}
        <div class="text-center py-12">
          <Icon icon={mdiImageMultiple} size="3em" class="text-gray-400 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">No faces found for this person</p>
        </div>
      {:else}
        <!-- Face grid -->
        <div class="grid gap-3 {thumbnailSize === 'small' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'}">
          {#each visibleFaces as face, index (`${face.id}-${index}`)}
            <div class="relative group">
              <div
                class="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square"
              >
                <img
                  src={getAssetThumbnailUrl(face.assetId, thumbnailSize === 'large' ? 'preview' : 'thumbnail')}
                  alt="Face"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          {/each}
        </div>

        <!-- Load more button -->
        {#if remainingCount > 0}
          <div class="mt-4 text-center">
            <Button color="secondary" onclick={loadMore}>
              <Icon icon={mdiChevronDown} size="1.25em" />
              Load {Math.min(remainingCount, LOAD_MORE_INCREMENT)} more
              <span class="text-gray-500 dark:text-gray-400">({remainingCount} remaining)</span>
            </Button>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
        These are all the detected faces for this person. Use this to verify if the person is correctly identified.
      </p>
    </div>
  </div>
</div>
