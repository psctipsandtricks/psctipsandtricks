import { Module } from '@nestjs/common';
import { PdfsService } from './pdfs.service';
import { PdfsController } from './pdfs.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [PdfsController],
  providers: [PdfsService],
  exports: [PdfsService],
})
export class PdfsModule {}
