import { writable } from 'svelte/store';
import type { Person } from '$lib/types';

interface PeopleState {
  people: Person[];
  hasFetched: boolean;
  lastFetched: Date | null;
  threshold: number;
}

const initialState: PeopleState = {
  people: [],
  hasFetched: false,
  lastFetched: null,
  threshold: 80
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
    updatePeople: (updater: (people: Person[]) => Person[]) =>
      update((state) => ({
        ...state,
        people: updater(state.people)
      })),
    reset: () => set(initialState)
  };
}

export const peopleStore = createPeopleStore();
