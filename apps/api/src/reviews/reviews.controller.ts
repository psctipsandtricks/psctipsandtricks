import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

const MANAGE_REVIEWS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({ summary: 'Active customer reviews for the public home page' })
  @Get('active')
  async findActive() {
    return this.reviewsService.findActive();
  }

  @ApiOperation({ summary: 'List all customer reviews (Admin / Staff with manage_reviews)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_REVIEWS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageReviews')
  @Get()
  async findAll() {
    return this.reviewsService.findAll();
  }

  @ApiOperation({ summary: 'Create a customer review (Admin / Staff with manage_reviews)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_REVIEWS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageReviews')
  @Post()
  async create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.create(dto);
  }

  @ApiOperation({ summary: 'Reorder customer reviews (Admin / Staff with manage_reviews)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_REVIEWS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageReviews')
  @Patch('reorder')
  async reorder(@Body() body: { ids: string[] }) {
    return this.reviewsService.reorder(body.ids || []);
  }

  @ApiOperation({ summary: 'Update a review, or just enable/disable it (Admin / Staff with manage_reviews)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_REVIEWS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageReviews')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a customer review (Admin / Staff with manage_reviews)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_REVIEWS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageReviews')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
