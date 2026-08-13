import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const CARGO_ADMIN_STATUSES = [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'returned',
  'cancelled',
] as const;

export type CargoAdminStatus = (typeof CARGO_ADMIN_STATUSES)[number];

/**
 * Body for ops advancing a shipment through its lifecycle. No carrier API
 * is integrated: ops manually enters the status the real-world carrier
 * reported (by phone, tracking page, etc). Carrier name / tracking number
 * are optional supplementary info that can be attached at any step, not a
 * precondition for advancing the status.
 */
export class UpdateCargoStatusDto {
  @ApiProperty({
    description: 'Next lifecycle status for the shipment, as reported by the carrier',
    enum: CARGO_ADMIN_STATUSES,
  })
  @IsIn(CARGO_ADMIN_STATUSES)
  status: CargoAdminStatus;

  @ApiPropertyOptional({ description: 'Carrier name for this shipment', example: 'Aras Kargo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cargoCompany?: string;

  @ApiPropertyOptional({ description: 'Real tracking number issued by the carrier', example: 'AR123456789' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  trackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Free-text note, mainly for exception statuses (failed_delivery/returned/cancelled) — e.g. why delivery failed',
    example: 'Adreste kimse yoktu',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
