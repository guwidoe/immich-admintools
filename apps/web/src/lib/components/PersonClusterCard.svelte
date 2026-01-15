<script lang="ts">
  import { Card, CardBody, Button, Icon } from '@immich/ui';
  import { mdiCallMerge, mdiCheckboxBlankOutline, mdiCheckboxMarked } from '@mdi/js';
  import type { Person, PersonCluster } from '$lib/types';
  import PersonThumbnail from './PersonThumbnail.svelte';

  interface Props {
    cluster: PersonCluster;
    selected: boolean;
    merging?: boolean;
    selectedPeopleIds: Set<string>;
    onToggleSelect: () => void;
    onPrimaryChange: (personId: string) => void;
    onTogglePersonSelection: (personId: string) => void;
    onMerge: () => void;
    onViewFaces?: (person: Person) => void;
  }

  let {
    cluster,
    selected,
    merging = false,
    selectedPeopleIds,
    onToggleSelect,
    onPrimaryChange,
    onTogglePersonSelection,
    onMerge,
    onViewFaces
  }: Props = $props();

  // Count how many people will be merged (selected, non-primary)
  let mergeCount = $derived(
    cluster.people.filter((p) => p.id !== cluster.primaryId && selectedPeopleIds.has(p.id)).length
  );
</script>

<Card>
  <CardBody class="p-4">
    <div class="flex items-start gap-4">
      <!-- Selection checkbox -->
      <button
        type="button"
        class="mt-1 text-gray-500 hover:text-immich-primary dark:text-gray-400 dark:hover:text-immich-dark-primary"
        onclick={onToggleSelect}
        aria-label={selected ? 'Deselect cluster' : 'Select cluster'}
      >
        <Icon icon={selected ? mdiCheckboxMarked : mdiCheckboxBlankOutline} size="1.5em" />
      </button>

      <!-- Cluster content -->
      <div class="flex-1 min-w-0">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">
              "{cluster.representativeName}"
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {cluster.people.length} people &middot; {cluster.similarity}% similar
              {#if mergeCount < cluster.people.length - 1}
                <span class="text-warning-600 dark:text-warning-400">
                  &middot; {mergeCount} selected to merge
                </span>
              {/if}
            </p>
          </div>
          <Button
            size="small"
            color="primary"
            onclick={onMerge}
            disabled={merging || mergeCount === 0}
          >
            {merging ? 'Merging...' : `Merge${mergeCount > 0 ? ` (${mergeCount})` : ''}`}
          </Button>
        </div>

        <!-- People row -->
        <div class="flex items-center gap-2 flex-wrap">
          {#each cluster.people as person, index (person.id)}
            {@const isPrimary = person.id === cluster.primaryId}
            {@const isSelected = selectedPeopleIds.has(person.id)}
            <div class="flex items-center">
              <PersonThumbnail
                {person}
                {isPrimary}
                {isSelected}
                size={70}
                onclick={() => onPrimaryChange(person.id)}
                onToggleSelect={isPrimary ? undefined : () => onTogglePersonSelection(person.id)}
                onViewFaces={onViewFaces ? () => onViewFaces(person) : undefined}
              />
              {#if index < cluster.people.length - 1 && isSelected && selectedPeopleIds.has(cluster.people[index + 1]?.id)}
                <div class="mx-1 text-gray-400 dark:text-gray-500">
                  <Icon icon={mdiCallMerge} size="1.25em" class="rotate-90" />
                </div>
              {:else if index < cluster.people.length - 1}
                <div class="mx-1 w-5"></div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Helper text -->
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Click a person to set as primary. Check/uncheck to include/exclude from merge. Hover to view faces.
        </p>
      </div>
    </div>
  </CardBody>
</Card>
