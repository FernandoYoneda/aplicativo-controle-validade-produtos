import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 40)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code deve conter apenas letras, números, hífen ou sublinhado.',
  })
  code!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  })
  @IsString()
  @Length(8, 32)
  @Matches(/^\d+$/, {
    message: 'barcode deve conter apenas números.',
  })
  barcode?: string | null;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  })
  @IsString()
  @Length(2, 120)
  brand?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  })
  @IsString()
  @Length(2, 120)
  category?: string | null;
}
