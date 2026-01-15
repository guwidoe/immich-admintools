import { Injectable } from '@nestjs/common';
import { ImmichApiService } from '../immich/immich-api.service';
import type { Person, BulkIdResult, FaceWithAsset } from './people.types';

@Injectable()
export class PeopleService {
  constructor(private readonly immichApiService: ImmichApiService) {}

  async getAllPeople(withHidden = true, withCounts = false): Promise<Person[]> {
    console.log(
      `[PeopleService] Fetching all people from Immich (withCounts: ${withCounts})`,
    );
    const people = withCounts
      ? await this.immichApiService.getPeopleWithCounts(withHidden)
      : await this.immichApiService.getPeople(withHidden);
    console.log(`[PeopleService] Found ${people.length} people`);
    return people;
  }

  async streamAllPeople(
    withHidden = true,
    onProgress: (progress: { type: string; loaded: number; total: number; page: number }) => void,
  ): Promise<Person[]> {
    console.log(`[PeopleService] Streaming people from Immich`);
    return this.immichApiService.getPeopleWithProgress(withHidden, onProgress);
  }

  async mergePeople(primaryId: string, ids: string[]): Promise<BulkIdResult[]> {
    console.log(
      `[PeopleService] Merging ${ids.length} people into ${primaryId}`,
    );
    const results = await this.immichApiService.mergePeople(primaryId, ids);
    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[PeopleService] Merge complete: ${successCount}/${ids.length} successful`,
    );
    return results;
  }

  async getPersonThumbnail(id: string): Promise<Buffer | null> {
    return this.immichApiService.getPersonThumbnail(id);
  }

  async getPersonFaces(personId: string): Promise<FaceWithAsset[]> {
    console.log(`[PeopleService] Fetching faces for person ${personId}`);
    const faces = await this.immichApiService.getPersonFaces(personId);
    console.log(`[PeopleService] Found ${faces.length} faces`);
    return faces;
  }

  async getAssetThumbnail(assetId: string, size: 'preview' | 'thumbnail' = 'thumbnail'): Promise<Buffer | null> {
    return this.immichApiService.getAssetThumbnail(assetId, size);
  }
}
