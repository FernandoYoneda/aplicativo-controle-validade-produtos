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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { CreateExpirationDto } from './dto/create-expiration.dto';
import { CreateWriteOffDto } from './dto/create-write-off.dto';
import { ListExpirationAlertsQueryDto } from './dto/list-expiration-alerts-query.dto';
import {
  FilterExpirationsQueryDto,
  ListExpirationsQueryDto,
} from './dto/list-expirations-query.dto';
import { UpdateExpirationDto } from './dto/update-expiration.dto';
import {
  ListWriteOffsQueryDto,
  SearchWriteOffQueryDto,
} from './dto/search-write-off-query.dto';
import type {
  ExpirationAlertAcknowledgement,
  ExpirationAlertPage,
} from './expiration-alert.types';
import type {
  ExpirationOverview,
  ExpirationPage,
} from './expiration-page.types';
import {
  type ExpirationRecord,
  ExpirationsService,
} from './expirations.service';
import type {
  ExpirationWriteOffRecord,
  ExpirationWriteOffResult,
} from './expiration-write-off.types';

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

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  findOverview(
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationOverview> {
    return this.expirationsService.findOverview(request.user);
  }

  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  findAlerts(
    @Query() query: ListExpirationAlertsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationAlertPage> {
    return this.expirationsService.findAlerts(query, request.user);
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  async exportSpreadsheet(
    @Query() query: FilterExpirationsQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const report = await this.expirationsService.exportSpreadsheet(
      query,
      request.user,
    );
    response.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${report.fileName}"`,
      'Content-Length': String(report.buffer.length),
    });

    return new StreamableFile(report.buffer);
  }

  @Get('write-off/search')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  searchWriteOffCandidates(
    @Query() query: SearchWriteOffQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationRecord[]> {
    return this.expirationsService.searchWriteOffCandidates(
      query,
      request.user,
    );
  }

  @Get('write-offs')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  findWriteOffs(
    @Query() query: ListWriteOffsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationWriteOffRecord[]> {
    return this.expirationsService.findWriteOffs(query, request.user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  create(
    @Body() createExpirationDto: CreateExpirationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationRecord> {
    return this.expirationsService.create(createExpirationDto, request.user);
  }

  @Post(':id/write-off')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  writeOff(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() createWriteOffDto: CreateWriteOffDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationWriteOffResult> {
    return this.expirationsService.writeOff(
      id,
      createWriteOffDto,
      request.user,
    );
  }

  @Post(':id/alert-acknowledgements')
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  acknowledgeAlert(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpirationAlertAcknowledgement> {
    return this.expirationsService.acknowledgeAlert(id, request.user);
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
