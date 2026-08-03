import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @ApiOperation({ summary: 'List all quizzes and live mock tests' })
  @Get()
  async findAll() {
    return this.quizzesService.findAll();
  }

  @ApiOperation({ summary: 'Get quiz details by ID with questions' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.quizzesService.findOne(id);
  }

  @ApiOperation({ summary: 'Get quiz leaderboard/rank list' })
  @Get(':id/leaderboard')
  async getLeaderboard(@Param('id') id: string) {
    return this.quizzesService.getLeaderboard(id);
  }

  @ApiOperation({ summary: 'Create a new quiz (Admin)' })
  @Post()
  async create(@Body() body: any) {
    return this.quizzesService.create(body);
  }

  @ApiOperation({ summary: 'Submit quiz responses' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/submit')
  async submitQuiz(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.quizzesService.submitQuiz(req.user.id, id, body);
  }
}
