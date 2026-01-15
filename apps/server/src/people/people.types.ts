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

export interface PersonFace {
  id: string;
  imageHeight: number;
  imageWidth: number;
  boundingBoxX1: number;
  boundingBoxX2: number;
  boundingBoxY1: number;
  boundingBoxY2: number;
  sourceType: string;
  person: {
    id: string;
    name: string;
    birthDate: string | null;
    thumbnailPath: string;
    isHidden: boolean;
  } | null;
}

export interface AssetFace extends PersonFace {
  assetId: string;
}

export interface FaceWithAsset {
  id: string;
  assetId: string;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}
