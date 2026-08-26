import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { CreateExpirationDto } from './dto/create-expiration.dto';
import { ListExpirationsQueryDto } from './dto/list-expirations-query.dto';
import { UpdateExpirationDto } from './dto/update-expiration.dto';
import type { ExpirationPage } from './expiration-page.types';
import {
  type ExpirationRecord,
  ExpirationsService,
} from './expirations.service';

@Controller('expirations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpirationsController {
  constructor(private readonly expirationsService: ExpirationsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  findAll(@Req() request: AuthenticatedRequest): Promise<ExpirationRecord[]> {
    return this.expirationsService.findAll(request.user);
  }

  @Get('page')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  findPage(
    @Query() query: ListExpirationsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationPage> {
    return this.expirationsService.findPage(query, request.user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  create(
    @Body() createExpirationDto: CreateExpirationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationRecord> {
    return this.expirationsService.create(createExpirationDto, request.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateExpirationDto: UpdateExpirationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationRecord> {
    return this.expirationsService.update(
      id,
      updateExpirationDto,
      request.user,
    );
  }
}
