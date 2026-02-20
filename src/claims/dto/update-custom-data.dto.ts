import { IsOptional, IsString, IsNumber, IsUrl, IsObject } from 'class-validator';

export class UpdateCustomDataDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  preferredFoot?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsObject()
  extraStats?: Record<string, any>;
}
