<script lang="ts">
  import { Card, CardBody, Button, Icon } from '@immich/ui';
  import { mdiCheck, mdiClose, mdiLoading } from '@mdi/js';
  import type { MergeResult } from '$lib/types';

  interface Props {
    total: number;
    completed: number;
    results: MergeResult[];
    onClose: () => void;
  }

  let { total, completed, results, onClose }: Props = $props();

  let isComplete = $derived(completed >= total);
  let successCount = $derived(results.filter((r) => r.success).length);
  let failureCount = $derived(results.filter((r) => !r.success).length);
</script>

<!-- Backdrop -->
<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <Card class="w-full max-w-md">
    <CardBody class="p-6">
      <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        {isComplete ? 'Merge Complete' : 'Merging People...'}
      </h2>

      {#if !isComplete}
        <!-- Progress bar -->
        <div class="mb-4">
          <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{completed} / {total}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              class="bg-immich-primary h-2 rounded-full transition-all duration-300"
              style="width: {(completed / total) * 100}%"
            ></div>
          </div>
        </div>

        <div class="flex items-center justify-center py-4">
          <Icon icon={mdiLoading} size="2em" class="animate-spin text-immich-primary" />
        </div>
      {:else}
        <!-- Results summary -->
        <div class="space-y-3 mb-4">
          <div class="flex items-center gap-2 text-success-600 dark:text-success-400">
            <Icon icon={mdiCheck} size="1.25em" />
            <span>{successCount} cluster{successCount !== 1 ? 's' : ''} merged successfully</span>
          </div>
          {#if failureCount > 0}
            <div class="flex items-center gap-2 text-danger-600 dark:text-danger-400">
              <Icon icon={mdiClose} size="1.25em" />
              <span>{failureCount} cluster{failureCount !== 1 ? 's' : ''} failed</span>
            </div>
          {/if}
        </div>

        <!-- Detailed results -->
        {#if results.length > 0}
          <div class="max-h-48 overflow-y-auto border rounded-lg dark:border-gray-700">
            {#each results as result (result.clusterId)}
              <div
                class="flex items-center justify-between px-3 py-2 border-b last:border-b-0 dark:border-gray-700"
              >
                <span class="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {result.clusterId.substring(0, 20)}...
                </span>
                {#if result.success}
                  <Icon icon={mdiCheck} size="1em" class="text-success-500 flex-shrink-0" />
                {:else}
                  <Icon icon={mdiClose} size="1em" class="text-danger-500 flex-shrink-0" />
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="mt-4 flex justify-end">
          <Button color="primary" onclick={onClose}>Close</Button>
        </div>
      {/if}
    </CardBody>
  </Card>
</div>
