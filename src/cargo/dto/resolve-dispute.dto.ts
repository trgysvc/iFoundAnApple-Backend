import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const DISPUTE_RESOLUTIONS = ['confirmed', 'returned'] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

/**
 * Body for ops resolving a disputed delivery after investigating outside
 * the system. 'confirmed' proceeds as if the owner had confirmed receipt
 * normally (unblocks escrow release); 'returned' sends the device back to
 * the finder.
 */
export class ResolveDisputeDto {
  @ApiProperty({
    description: 'How the dispute was resolved',
    enum: DISPUTE_RESOLUTIONS,
  })
  @IsIn(DISPUTE_RESOLUTIONS)
  resolution: DisputeResolution;
}
