import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class FeeBreakdownDto {
  @ApiProperty({
    description: 'Reward amount for finder (20% of total)',
    example: 400.0,
  })
  @IsNotEmpty()
  @IsNumber()
  rewardAmount: number;

  @ApiProperty({
    description: 'Cargo fee (fixed 250.00 TL)',
    example: 250.0,
  })
  @IsNotEmpty()
  @IsNumber()
  cargoFee: number;

  @ApiProperty({
    description: 'Service fee (remaining amount)',
    example: 1281.4,
  })
  @IsNotEmpty()
  @IsNumber()
  serviceFee: number;

  @ApiProperty({
    description: 'Gateway commission fee (3.43% of total)',
    example: 68.6,
  })
  @IsNotEmpty()
  @IsNumber()
  gatewayFee: number;

  @ApiProperty({
    description: 'Total amount',
    example: 2000.0,
  })
  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty({
    description: 'Net payout to finder',
    example: 400.0,
  })
  @IsNotEmpty()
  @IsNumber()
  netPayout: number;
}

