import { PartialType } from '@nestjs/swagger';
import { CreateQuizDto } from './create-quiz.dto';

/**
 * Every field is optional on update, so callers can PUT a single slice of the
 * quiz — the Questions Studio, for example, saves only `questions` and
 * `totalMarks` and must not be forced to resend title/description.
 */
export class UpdateQuizDto extends PartialType(CreateQuizDto) {}
