import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsNumber, ValidateNested, IsString, Matches, Length } from 'class-validator';
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

  @ApiProperty({
    description: 'Card number (PAN) - Required for Paynet 3D Secure payment',
    example: '4506341234567890',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{13,19}$/, {
    message: 'Card number must be 13-19 digits',
  })
  pan: string;

  @ApiProperty({
    description: 'Card expiration month (MM format) - Required for Paynet 3D Secure payment',
    example: '12',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])$/, {
    message: 'Month must be in MM format (01-12)',
  })
  month: string;

  @ApiProperty({
    description: 'Card expiration year (YY or YYYY format) - Required for Paynet 3D Secure payment',
    example: '2025',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(\d{2}|\d{4})$/, {
    message: 'Year must be in YY or YYYY format',
  })
  year: string;

  @ApiProperty({
    description: 'Card CVV/CVC code - Required for Paynet 3D Secure payment',
    example: '123',
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 4, {
    message: 'CVV must be 3 or 4 digits',
  })
  @Matches(/^\d{3,4}$/, {
    message: 'CVV must contain only digits',
  })
  cvc: string;

  @ApiProperty({
    description: 'Card holder name - Required for Paynet 3D Secure payment',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  cardHolder: string;
}

