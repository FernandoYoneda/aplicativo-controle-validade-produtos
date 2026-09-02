import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ExpirationAlertStatusFilter {
  ALL = 'all',
  EXPIRED = 'expired',
  UPCOMING = 'upcoming',
}

export enum ExpirationAlertReviewFilter {
  ALL = 'all',
  PENDING = 'pending',
  REVIEWED = 'reviewed',
}

export class ListExpirationAlertsQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsEnum(ExpirationAlertStatusFilter)
  status = ExpirationAlertStatusFilter.ALL;

  @IsEnum(ExpirationAlertReviewFilter)
  review = ExpirationAlertReviewFilter.ALL;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
