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

export enum ExpirationStatusFilter {
  ALL = 'all',
  EXPIRED = 'expired',
  UPCOMING = 'upcoming',
  VALID = 'valid',
  INACTIVE = 'inactive',
}

export class ListExpirationsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsEnum(ExpirationStatusFilter)
  status = ExpirationStatusFilter.ALL;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
