import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class Complete3DPaymentDto {
  @ApiProperty({
    description: 'Payment ID (reference_no from initial payment)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;

  @ApiProperty({
    description: 'Session ID from PAYNET 3D Secure callback',
    example: 'session_abc123xyz',
  })
  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Token ID from PAYNET 3D Secure callback',
    example: 'token_abc123xyz',
  })
  @IsNotEmpty()
  @IsString()
  tokenId: string;
}


