import { PartialType } from '@nestjs/swagger';
import { CreateSubtopicDto } from './create-subtopic.dto';

export class UpdateSubtopicDto extends PartialType(CreateSubtopicDto) {}
