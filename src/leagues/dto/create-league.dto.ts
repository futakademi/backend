import { IsString, MinLength } from 'class-validator';

export class CreateLeagueDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  season: string;
}
