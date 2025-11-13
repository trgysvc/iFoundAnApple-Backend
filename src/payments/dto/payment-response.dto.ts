import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID' })
  id: string;

  @ApiProperty({ description: 'Device ID' })
  deviceId: string;

  @ApiProperty({ description: 'Payment status' })
  paymentStatus: string;

  @ApiProperty({ description: 'Escrow status' })
  escrowStatus: string;

  @ApiProperty({ description: 'Total amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Payment provider transaction ID (if available)' })
  providerTransactionId?: string;

  @ApiProperty({ description: 'PAYNET publishable key for frontend integration' })
  publishableKey?: string;

  @ApiProperty({ description: 'Payment URL for redirect (if available)' })
  paymentUrl?: string;
}

