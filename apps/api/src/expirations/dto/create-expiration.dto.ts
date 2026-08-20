import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateExpirationDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  })
  @IsString()
  @Length(1, 80)
  batchNumber?: string | null;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'expirationDate deve utilizar o formato AAAA-MM-DD.',
  })
  @IsDateString(
    {
      strict: true,
    },
    {
      message: 'expirationDate deve ser uma data válida.',
    },
  )
  expirationDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  })
  @IsString()
  @Length(1, 500)
  notes?: string | null;
}
