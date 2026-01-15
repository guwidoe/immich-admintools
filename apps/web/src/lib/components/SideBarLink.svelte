<script lang="ts">
  import { page } from '$app/stores';
  import { Icon } from '@immich/ui';

  interface Props {
    title: string;
    href: string;
    icon: string;
  }

  let { title, href, icon }: Props = $props();

  let currentPath = $derived($page.url.pathname);

  function isSelected(): boolean {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  }

  let selected = $derived(isSelected());
</script>

<a
  tabindex="0"
  {href}
  data-sveltekit-preload-data="hover"
  draggable="false"
  aria-current={selected ? 'page' : undefined}
  class="flex w-full place-items-center gap-4 rounded-e-full py-3 transition-[padding] delay-100 duration-100 hover:cursor-pointer hover:bg-immich-gray hover:text-immich-primary dark:text-immich-dark-fg dark:hover:bg-immich-dark-gray dark:hover:text-immich-dark-primary
  {selected
    ? 'bg-immich-primary/10 dark:text-immich-dark-primary text-immich-primary hover:bg-immich-primary/10 dark:bg-immich-dark-primary/10'
    : ''}"
>
  <div class="flex w-full place-items-center gap-4 ps-5 overflow-hidden truncate">
    <Icon {icon} size="1.5em" class="shrink-0" aria-hidden="true" />
    <span class="text-sm font-medium">{title}</span>
  </div>
</a>
