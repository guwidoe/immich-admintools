import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PeopleService } from './people.service';
import type { Person, MergePeopleDto, BulkIdResult } from './people.types';

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
}
