<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Icon, LoadingSpinner } from '@immich/ui';
  import {
    mdiClose,
    mdiChevronDown,
    mdiImageMultiple,
    mdiFaceRecognition,
    mdiImage,
    mdiImageSizeSelectLarge
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
  // Three view modes: 'face' (zoomed to face), 'small' (full image small), 'large' (full image large)
  let viewMode = $state<'face' | 'small' | 'large'>('face');
  let showCount = $state(12);

  // Track image dimensions for proper bounding box overlay
  let imageDimensions = $state<Map<string, { width: number; height: number; containerWidth: number; containerHeight: number }>>(new Map());

  const LOAD_MORE_INCREMENT = 12;

  // Target: face should fill ~30% of thumbnail in its larger dimension
  const FACE_FILL_TARGET = 0.5;

  let visibleFaces = $derived(faces.slice(0, showCount));
  let remainingCount = $derived(Math.max(0, faces.length - showCount));

  // Grid columns based on view mode
  let gridClass = $derived(
    viewMode === 'large'
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-4 sm:grid-cols-6'
  );

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

  function cycleViewMode() {
    // Cycle: face -> small -> large -> face
    if (viewMode === 'face') {
      viewMode = 'small';
    } else if (viewMode === 'small') {
      viewMode = 'large';
    } else {
      viewMode = 'face';
    }
    // Reset dimensions when mode changes
    imageDimensions = new Map();
  }

  function getViewModeLabel(): string {
    switch (viewMode) {
      case 'face': return 'Face Zoom';
      case 'small': return 'Full Image';
      case 'large': return 'Large';
    }
  }

  function getViewModeIcon(): string {
    switch (viewMode) {
      case 'face': return mdiFaceRecognition;
      case 'small': return mdiImage;
      case 'large': return mdiImageSizeSelectLarge;
    }
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

  function handleImageLoad(e: Event, faceId: string) {
    const img = e.target as HTMLImageElement;
    const container = img.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate rendered image dimensions (object-contain behavior)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;

    if (imgAspect > containerAspect) {
      // Image is wider, constrained by width
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imgAspect;
    } else {
      // Image is taller, constrained by height
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imgAspect;
    }

    const newMap = new Map(imageDimensions);
    newMap.set(faceId, {
      width: renderedWidth,
      height: renderedHeight,
      containerWidth,
      containerHeight
    });
    imageDimensions = newMap;
  }

  function getBoxStyle(face: FaceWithAsset): string {
    const dims = imageDimensions.get(face.id);
    if (!dims) {
      // Fallback: assume image fills container
      return `
        left: ${face.boundingBox.x1 * 100}%;
        top: ${face.boundingBox.y1 * 100}%;
        width: ${(face.boundingBox.x2 - face.boundingBox.x1) * 100}%;
        height: ${(face.boundingBox.y2 - face.boundingBox.y1) * 100}%;
      `;
    }

    // Calculate offset for centered image
    const offsetX = (dims.containerWidth - dims.width) / 2;
    const offsetY = (dims.containerHeight - dims.height) / 2;

    // Calculate box position relative to container
    const left = offsetX + face.boundingBox.x1 * dims.width;
    const top = offsetY + face.boundingBox.y1 * dims.height;
    const width = (face.boundingBox.x2 - face.boundingBox.x1) * dims.width;
    const height = (face.boundingBox.y2 - face.boundingBox.y1) * dims.height;

    return `
      left: ${left}px;
      top: ${top}px;
      width: ${width}px;
      height: ${height}px;
    `;
  }

  // Calculate zoom/crop style for face-focused view
  function getFaceZoomStyle(face: FaceWithAsset): string {
    const { x1, y1, x2, y2 } = face.boundingBox;
    const faceWidth = x2 - x1;
    const faceHeight = y2 - y1;
    const faceCenterX = (x1 + x2) / 2;
    const faceCenterY = (y1 + y2) / 2;

    // Calculate scale so face fills ~FACE_FILL_TARGET of the view
    const maxFaceDim = Math.max(faceWidth, faceHeight);
    const scale = FACE_FILL_TARGET / maxFaceDim;

    // Clamp scale to reasonable bounds (don't zoom in more than 5x or less than 1x)
    const clampedScale = Math.min(Math.max(scale, 1), 5);

    // Calculate background position to center the face
    // When scaled, we need to position so face center is at 50% 50%
    const bgPosX = faceCenterX * 100;
    const bgPosY = faceCenterY * 100;

    // Background size is scale * 100%
    const bgSize = clampedScale * 100;

    return `
      background-size: ${bgSize}%;
      background-position: ${bgPosX}% ${bgPosY}%;
    `;
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
        <Button size="small" color="secondary" onclick={cycleViewMode}>
          <Icon icon={getViewModeIcon()} size="1.25em" />
          {getViewModeLabel()}
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
        <div class="grid gap-3 {gridClass}">
          {#each visibleFaces as face, index (`${face.id}-${index}-${viewMode}`)}
            <div class="relative group">
              {#if viewMode === 'face'}
                <!-- Face zoom mode: cropped/zoomed view centered on face -->
                <div
                  class="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square"
                  style="
                    background-image: url({getAssetThumbnailUrl(face.assetId, 'preview')});
                    background-repeat: no-repeat;
                    {getFaceZoomStyle(face)}
                  "
                  role="img"
                  aria-label="Face thumbnail"
                ></div>
              {:else}
                <!-- Full image mode: show entire image with face rect overlay -->
                <div
                  class="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square relative"
                >
                  <img
                    src={getAssetThumbnailUrl(face.assetId, viewMode === 'large' ? 'preview' : 'thumbnail')}
                    alt="Face"
                    class="w-full h-full object-contain"
                    loading="lazy"
                    onload={(e) => handleImageLoad(e, face.id)}
                  />
                  <!-- Face bounding box overlay -->
                  <div
                    class="absolute border-2 border-immich-primary dark:border-immich-dark-primary rounded-sm pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                    style={getBoxStyle(face)}
                  ></div>
                </div>
              {/if}
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
