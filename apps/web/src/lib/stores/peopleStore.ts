import { writable } from 'svelte/store';
import type { Person, PersonCluster } from '$lib/types';

interface PeopleState {
  people: Person[];
  hasFetched: boolean;
  lastFetched: Date | null;
  threshold: number;
  // Persisted UI state
  clusters: PersonCluster[];
  selectedClusterIds: string[];
  clusterPersonSelections: Record<string, string[]>; // clusterId -> personIds[]
}

const initialState: PeopleState = {
  people: [],
  hasFetched: false,
  lastFetched: null,
  threshold: 80,
  clusters: [],
  selectedClusterIds: [],
  clusterPersonSelections: {}
};

function createPeopleStore() {
  const { subscribe, set, update } = writable<PeopleState>(initialState);

  return {
    subscribe,
    setPeople: (people: Person[]) =>
      update((state) => ({
        ...state,
        people,
        hasFetched: true,
        lastFetched: new Date()
      })),
    setThreshold: (threshold: number) =>
      update((state) => ({
        ...state,
        threshold
      })),
    setClusters: (clusters: PersonCluster[]) =>
      update((state) => ({
        ...state,
        clusters
      })),
    setSelectedClusterIds: (ids: string[]) =>
      update((state) => ({
        ...state,
        selectedClusterIds: ids
      })),
    setClusterPersonSelections: (selections: Record<string, string[]>) =>
      update((state) => ({
        ...state,
        clusterPersonSelections: selections
      })),
    updatePeople: (updater: (people: Person[]) => Person[]) =>
      update((state) => ({
        ...state,
        people: updater(state.people)
      })),
    // Update all state at once (for batch updates)
    updateState: (partial: Partial<PeopleState>) =>
      update((state) => ({
        ...state,
        ...partial
      })),
    reset: () => set(initialState)
  };
}

export const peopleStore = createPeopleStore();
