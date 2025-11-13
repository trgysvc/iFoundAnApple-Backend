import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Device ID for the payment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  deviceId: string;

  @ApiProperty({
    description: 'Total amount from frontend (will be validated against database)',
    example: 2000.0,
  })
  @IsNotEmpty()
  totalAmount: number;
}

