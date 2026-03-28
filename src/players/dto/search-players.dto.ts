import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPlayersDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  club?: string;

  // ✅ EKLENDİ: teamId ile direkt takım ID'sine göre filtre
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  league?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  birthYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500) // ✅ DÜZELTİLDİ: 100 → 500 (takım kadrosu için yeterli)
  limit?: number = 20;
}
