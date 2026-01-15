import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  HttpStatus,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { PeopleService } from './people.service';
import type { Person, MergePeopleDto, BulkIdResult, FaceWithAsset } from './people.types';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  async getPeople(
    @Query('withHidden') withHidden?: string,
    @Query('withCounts') withCounts?: string,
  ): Promise<Person[]> {
    const includeHidden = withHidden !== 'false';
    const includeCounts = withCounts === 'true';
    return this.peopleService.getAllPeople(includeHidden, includeCounts);
  }

  @Sse('stream')
  streamPeople(
    @Query('withHidden') withHidden?: string,
  ): Observable<MessageEvent> {
    const includeHidden = withHidden !== 'false';
    const subject = new Subject<MessageEvent>();

    this.peopleService
      .streamAllPeople(includeHidden, (progress) => {
        subject.next({
          data: JSON.stringify(progress),
        } as MessageEvent);
      })
      .then((people) => {
        subject.next({
          data: JSON.stringify({ type: 'complete', people }),
        } as MessageEvent);
        subject.complete();
      })
      .catch((error) => {
        subject.next({
          data: JSON.stringify({ type: 'error', message: error.message }),
        } as MessageEvent);
        subject.complete();
      });

    return subject.asObservable();
  }

  @Post(':id/merge')
  async mergePeople(
    @Param('id') primaryId: string,
    @Body() body: MergePeopleDto,
  ): Promise<BulkIdResult[]> {
    return this.peopleService.mergePeople(primaryId, body.ids);
  }

  @Get(':id/thumbnail')
  async getPersonThumbnail(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const thumbnail = await this.peopleService.getPersonThumbnail(id);

    if (!thumbnail) {
      res.status(HttpStatus.NOT_FOUND).send('Thumbnail not found');
      return;
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': thumbnail.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(thumbnail);
  }

  @Get(':id/faces')
  async getPersonFaces(@Param('id') id: string): Promise<FaceWithAsset[]> {
    return this.peopleService.getPersonFaces(id);
  }

  @Get('assets/:assetId/thumbnail')
  async getAssetThumbnail(
    @Param('assetId') assetId: string,
    @Query('size') size?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const thumbnailSize = size === 'preview' ? 'preview' : 'thumbnail';
    const thumbnail = await this.peopleService.getAssetThumbnail(assetId, thumbnailSize);

    if (!thumbnail || !res) {
      res?.status(HttpStatus.NOT_FOUND).send('Thumbnail not found');
      return;
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': thumbnail.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(thumbnail);
  }
}
