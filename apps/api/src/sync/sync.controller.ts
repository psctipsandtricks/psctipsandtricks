import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { SyncService, SyncStatusResponse } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @ApiOperation({
    summary: 'Public content revision status — lightweight polling endpoint for mobile apps to detect updates',
  })
  @Get('status')
  async getStatus(): Promise<SyncStatusResponse> {
    return this.syncService.getSyncStatus();
  }

  @ApiOperation({
    summary: 'Real-time Server-Sent Events stream for instant content update notifications',
  })
  @Sse('events')
  syncEvents(): Observable<MessageEvent> {
    return this.syncService.getEventsObservable();
  }
}
