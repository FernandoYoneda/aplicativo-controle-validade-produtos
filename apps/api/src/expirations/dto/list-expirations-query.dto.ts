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
  THREE_MONTHS = 'threeMonths',
  SIX_MONTHS = 'sixMonths',
  ONE_YEAR = 'oneYear',
  BEYOND_ONE_YEAR = 'beyondOneYear',
  INACTIVE = 'inactive',
}

export class FilterExpirationsQueryDto {
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

export class ListExpirationsQueryDto extends FilterExpirationsQueryDto {
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
