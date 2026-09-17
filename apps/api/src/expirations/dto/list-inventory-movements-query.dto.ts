import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum InventoryMovementTypeFilter {
  ALL = 'all',
  ENTRY = 'entry',
  ADJUSTMENT = 'adjustment',
  WRITE_OFF = 'writeOff',
  REVERSAL = 'reversal',
}

export class ListInventoryMovementsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsEnum(InventoryMovementTypeFilter)
  type = InventoryMovementTypeFilter.ALL;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
