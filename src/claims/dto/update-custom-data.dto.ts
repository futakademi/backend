import { IsOptional, IsString, IsNumber, IsArray, IsObject } from 'class-validator';

export class UpdateCustomDataDto {
  @IsOptional() @IsString()
  bio?: string;

  @IsOptional() @IsNumber()
  height?: number;

  @IsOptional() @IsNumber()
  weight?: number;

  @IsOptional() @IsString()
  preferredFoot?: string;

  @IsOptional() @IsString()
  photoUrl?: string;

  @IsOptional() @IsArray()
  videos?: { url: string; title?: string; addedAt?: string }[];

  @IsOptional() @IsString()
  instagram?: string;

  @IsOptional() @IsArray()
  careerHistory?: {
    club: string;
    league: string;
    season: string;
    matches?: number;
    goals?: number;
    assists?: number;
  }[];
}
