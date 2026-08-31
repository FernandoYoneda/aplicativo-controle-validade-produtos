import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductLotWriteOffReason } from '../../../generated/prisma/enums';

export class CreateWriteOffDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsEnum(ProductLotWriteOffReason)
  reason: ProductLotWriteOffReason;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
