import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for the owner disputing a delivered package instead of confirming
 * receipt — e.g. wrong device, damaged device, empty package. This blocks
 * escrow release until ops resolves the dispute.
 */
export class DisputeReceiptDto {
  @ApiProperty({
    description: 'Why the owner is disputing the delivery',
    example: 'Gelen cihaz benim kayıp cihazım değil',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
