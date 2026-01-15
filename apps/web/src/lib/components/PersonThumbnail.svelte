<script lang="ts">
  import { Icon } from '@immich/ui';
  import { mdiCheckboxBlankOutline, mdiCheckboxMarked, mdiImageMultiple } from '@mdi/js';
  import type { Person } from '$lib/types';
  import { getPersonThumbnailUrl } from '$lib/api/client';

  interface Props {
    person: Person;
    isPrimary?: boolean;
    isSelected?: boolean;
    size?: number;
    onclick?: () => void;
    onToggleSelect?: () => void;
    onViewFaces?: () => void;
  }

  let {
    person,
    isPrimary = false,
    isSelected = true,
    size = 80,
    onclick,
    onToggleSelect,
    onViewFaces
  }: Props = $props();

  let thumbnailUrl = $derived(getPersonThumbnailUrl(person.id));
  let imageError = $state(false);
</script>

<div class="relative group">
  <button
    type="button"
    class="flex flex-col items-center gap-2 p-2 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800 {isPrimary
      ? 'ring-2 ring-immich-primary ring-offset-2 dark:ring-offset-gray-900'
      : ''} {!isSelected && !isPrimary ? 'opacity-40' : ''}"
    {onclick}
  >
    <div
      class="relative rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0"
      style="width: {size}px; height: {size}px;"
    >
      {#if !imageError}
        <img
          src={thumbnailUrl}
          alt={person.name || 'Unknown person'}
          class="w-full h-full object-cover brightness-95"
          onerror={() => (imageError = true)}
        />
      {:else}
        <div class="w-full h-full flex items-center justify-center text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-1/2 h-1/2"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
            />
          </svg>
        </div>
      {/if}
      {#if isPrimary}
        <div
          class="absolute bottom-0 left-0 right-0 bg-immich-primary text-white text-xs py-0.5 text-center font-medium"
        >
          Primary
        </div>
      {/if}
    </div>
    <div class="text-center max-w-[{size + 20}px]">
      <p
        class="text-sm font-medium truncate {isPrimary
          ? 'text-immich-primary dark:text-immich-dark-primary'
          : 'text-gray-900 dark:text-gray-100'}"
        title={person.name}
      >
        {person.name || 'Unknown'}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {#if person.assetCount !== undefined}
          {person.assetCount} {person.assetCount === 1 ? 'photo' : 'photos'}
        {:else}
          -
        {/if}
        {#if person.isHidden}
          <span class="text-gray-400">(hidden)</span>
        {/if}
      </p>
    </div>
  </button>

  <!-- Selection checkbox (only for non-primary people) -->
  {#if onToggleSelect && !isPrimary}
    <button
      type="button"
      class="absolute top-0 right-0 p-1 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      onclick={(e) => {
        e.stopPropagation();
        onToggleSelect();
      }}
      aria-label={isSelected ? 'Exclude from merge' : 'Include in merge'}
    >
      <Icon
        icon={isSelected ? mdiCheckboxMarked : mdiCheckboxBlankOutline}
        size="1.25em"
        class={isSelected ? 'text-immich-primary dark:text-immich-dark-primary' : 'text-gray-400'}
      />
    </button>
  {/if}

  <!-- View faces button (appears on hover) -->
  {#if onViewFaces}
    <button
      type="button"
      class="absolute top-0 left-0 p-1 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
      onclick={(e) => {
        e.stopPropagation();
        onViewFaces();
      }}
      aria-label="View all faces for this person"
      title="View faces"
    >
      <Icon
        icon={mdiImageMultiple}
        size="1.25em"
        class="text-gray-600 dark:text-gray-300"
      />
    </button>
  {/if}
</div>
