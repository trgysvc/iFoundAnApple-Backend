import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FeeBreakdownDto } from './fee-breakdown.dto';

export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Device ID for payment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  deviceId: string;

  @ApiProperty({
    description: 'Total amount (will be validated against device_models.ifoundanapple_fee)',
    example: 2000.0,
  })
  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty({
    description: 'Fee breakdown calculated by frontend/iOS',
    type: FeeBreakdownDto,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => FeeBreakdownDto)
  feeBreakdown: FeeBreakdownDto;
}

