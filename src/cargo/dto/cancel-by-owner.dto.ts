import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for the owner cancelling their own transaction before the device has
 * shipped. Refunds the held escrow immediately via Paynet.
 */
export class CancelByOwnerDto {
  @ApiPropertyOptional({
    description: 'Why the owner is cancelling',
    example: 'Cihazımı buldum, artık gerek kalmadı',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
