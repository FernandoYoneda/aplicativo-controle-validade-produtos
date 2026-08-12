import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class CreateStoreDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code deve conter apenas letras, números, hífen ou sublinhado.',
  })
  code!: string;

  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 120)
  name!: string;
}
