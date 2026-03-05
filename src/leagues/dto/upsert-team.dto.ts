import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertTeamDto {
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsString()
  name: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) played?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) win?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) draw?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) loss?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) goalsFor?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) goalsAgainst?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) points?: number;
}
