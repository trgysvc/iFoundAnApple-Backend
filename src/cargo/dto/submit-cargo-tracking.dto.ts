import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for ops entering the real tracking number obtained from whichever
 * carrier they used to book the shipment. No carrier API is integrated,
 * so this value is exactly what the carrier printed on the waybill.
 */
export class SubmitCargoTrackingDto {
  @ApiProperty({ description: 'Carrier name used for this shipment', example: 'Aras Kargo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cargoCompany: string;

  @ApiProperty({ description: 'Real tracking number issued by the carrier', example: 'AR123456789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  trackingNumber: string;
}
