import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { StorageModule } from '../storage/storage.module';
import { AudioProcessingModule } from '../audio-processing/audio-processing.module';

@Module({
  imports: [StorageModule, AudioProcessingModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
