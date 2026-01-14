import { Module, Global } from '@nestjs/common';
import { ImmichApiService } from './immich-api.service';

@Global()
@Module({
  providers: [ImmichApiService],
  exports: [ImmichApiService],
})
export class ImmichModule {}
