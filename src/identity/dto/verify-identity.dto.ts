import { IsString, Length, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class VerifyIdentityDto {
  @IsString()
  @Length(11, 11, { message: 'TC kimlik numarası 11 haneli olmalıdır.' })
  @Matches(/^\d{11}$/, { message: 'TC kimlik numarası sadece rakamlardan oluşmalıdır.' })
  tckn: string;

  @IsString()
  @Length(2, 50)
  firstName: string;

  @IsString()
  @Length(2, 50)
  lastName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1940)
  @Max(new Date().getFullYear() - 16)
  birthYear: number;
}
