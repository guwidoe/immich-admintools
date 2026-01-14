import type { Person, PersonCluster } from '$lib/types';
import * as fuzz from 'fuzzball';

/**
 * Calculate similarity between two names using fuzzball's ratio.
 * This is a simple Levenshtein-based similarity (0-100).
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return fuzz.ratio(a.trim(), b.trim());
}

/**
 * Generate a unique cluster ID
 */
function generateClusterId(): string {
  return `cluster-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Group people by name similarity using union-find clustering
 */
export function clusterPeopleByName(
  people: Person[],
  threshold: number = 80
): PersonCluster[] {
  // Filter to only named people
  const namedPeople = people.filter((p) => p.name && p.name.trim());

  if (namedPeople.length === 0) return [];

  // Union-Find data structure for clustering
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

  // Track similarity scores for each pair
  const similarityScores = new Map<string, number>();

  // Compare all pairs and union similar ones
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

  // Group people by their root
  const groups = new Map<string, Person[]>();
  for (const person of namedPeople) {
    const root = find(person.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(person);
  }

  // Convert groups to clusters (only groups with 2+ people)
  const clusters: PersonCluster[] = [];

  for (const [, groupPeople] of groups) {
    if (groupPeople.length < 2) continue;

    // Calculate average similarity within cluster
    let totalSimilarity = 0;
    let pairCount = 0;
    for (let i = 0; i < groupPeople.length; i++) {
      for (let j = i + 1; j < groupPeople.length; j++) {
        const pairKey = [groupPeople[i].id, groupPeople[j].id].sort().join('-');
        const similarity = similarityScores.get(pairKey) || nameSimilarity(groupPeople[i].name, groupPeople[j].name);
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    const avgSimilarity = pairCount > 0 ? Math.round(totalSimilarity / pairCount) : 100;

    // Find the most common/representative name (longest name as heuristic)
    const representativeName = groupPeople.reduce((longest, p) =>
      p.name.length > longest.length ? p.name : longest
    , groupPeople[0].name);

    // Set primary as person with longest name (often the most complete)
    // Could also be the first alphabetically or user can change
    const sortedPeople = [...groupPeople].sort((a, b) => {
      // Sort by name length descending, then alphabetically
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

  // Sort clusters by similarity (highest first) then by size
  clusters.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return b.people.length - a.people.length;
  });

  return clusters;
}
