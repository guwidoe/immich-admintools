export interface Person {
  id: string;
  name: string;
  birthDate: string | null;
  thumbnailPath: string;
  isHidden: boolean;
  assetCount?: number;
}

export interface PersonStatistics {
  assets: number;
}

export interface MergePeopleDto {
  ids: string[];
}

export interface BulkIdResult {
  id: string;
  success: boolean;
  error?: 'NO_PERMISSION' | 'NOT_FOUND' | 'UNKNOWN';
}

export interface ImmichPeopleResponse {
  people: Person[];
  total: number;
  visible: number;
}
