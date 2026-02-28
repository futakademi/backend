import { IsUUID } from 'class-validator';

export class StartClaimDto {
  @IsUUID()
  playerId: string;
}
