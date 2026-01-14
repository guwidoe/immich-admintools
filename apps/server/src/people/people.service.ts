import { Injectable } from '@nestjs/common';
import { ImmichApiService } from '../immich/immich-api.service';
import type { Person, BulkIdResult } from './people.types';

@Injectable()
export class PeopleService {
  constructor(private readonly immichApiService: ImmichApiService) {}

  async getAllPeople(withHidden = true): Promise<Person[]> {
    console.log('[PeopleService] Fetching all people with counts from Immich');
    const people = await this.immichApiService.getPeopleWithCounts(withHidden);
    console.log(`[PeopleService] Found ${people.length} people`);
    return people;
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
}
