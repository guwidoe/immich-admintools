import type { Person, PersonCluster } from '$lib/types';
import * as fuzz from 'fuzzball';

function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return fuzz.ratio(a.trim(), b.trim());
}

function generateClusterId(): string {
  return `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function clusterPeopleByName(people: Person[], threshold: number = 80): PersonCluster[] {
  const namedPeople = people.filter((p) => p.name && p.name.trim());

  if (namedPeople.length === 0) return [];

  // Union-Find data structure
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  function find(id: string): string {
    if (!parent.has(id)) {
      parent.set(id, id);
      rank.set(id, 0);
    }
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;

    const rankA = rank.get(rootA) || 0;
    const rankB = rank.get(rootB) || 0;

    if (rankA < rankB) {
      parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootB, rootA);
      rank.set(rootA, rankA + 1);
    }
  }

  const similarityScores = new Map<string, number>();

  // Compare all pairs
  for (let i = 0; i < namedPeople.length; i++) {
    for (let j = i + 1; j < namedPeople.length; j++) {
      const personA = namedPeople[i];
      const personB = namedPeople[j];
      const similarity = nameSimilarity(personA.name, personB.name);

      if (similarity >= threshold) {
        union(personA.id, personB.id);
        const pairKey = [personA.id, personB.id].sort().join('-');
        similarityScores.set(pairKey, similarity);
      }
    }
  }

  // Group by root
  const groups = new Map<string, Person[]>();
  for (const person of namedPeople) {
    const root = find(person.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(person);
  }

  // Convert to clusters
  const clusters: PersonCluster[] = [];

  for (const [, groupPeople] of groups) {
    if (groupPeople.length < 2) continue;

    let totalSimilarity = 0;
    let pairCount = 0;
    for (let i = 0; i < groupPeople.length; i++) {
      for (let j = i + 1; j < groupPeople.length; j++) {
        const pairKey = [groupPeople[i].id, groupPeople[j].id].sort().join('-');
        const similarity =
          similarityScores.get(pairKey) || nameSimilarity(groupPeople[i].name, groupPeople[j].name);
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    const avgSimilarity = pairCount > 0 ? Math.round(totalSimilarity / pairCount) : 100;

    const representativeName = groupPeople.reduce(
      (longest, p) => (p.name.length > longest.length ? p.name : longest),
      groupPeople[0].name
    );

    const sortedPeople = [...groupPeople].sort((a, b) => {
      if (b.name.length !== a.name.length) {
        return b.name.length - a.name.length;
      }
      return a.name.localeCompare(b.name);
    });

    clusters.push({
      id: generateClusterId(),
      people: sortedPeople,
      primaryId: sortedPeople[0].id,
      similarity: avgSimilarity,
      representativeName
    });
  }

  clusters.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return b.people.length - a.people.length;
  });

  return clusters;
}

// Worker message handler
self.onmessage = (e: MessageEvent<{ people: Person[]; threshold: number }>) => {
  const { people, threshold } = e.data;
  const clusters = clusterPeopleByName(people, threshold);
  self.postMessage(clusters);
};
