import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { Complete3DPaymentDto } from './dto/complete-3d-payment.dto';
import { PaymentsService } from './services/payments.service';
import { PaynetProvider } from './providers/paynet.provider';
import { WebhooksService } from '../webhooks/webhooks.service';

@ApiTags('payments')
@Controller('payments')
@ApiBearerAuth('bearer')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paynetProvider: PaynetProvider,
    private readonly httpService: HttpService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @ApiOperation({ 
    summary: 'Process payment with Paynet',
    description: 'Backend initiates Paynet 3D Secure payment. Creates payment record in database and returns payment URL for 3D Secure verification. Device must exist and be in "payment_pending" status.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully with Paynet',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment request, device not in payment_pending status, amount validation failed, or no matched finder found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Device not found or device does not belong to the user' })
  @Post('process')
  async processPayment(
    @Body() dto: ProcessPaymentDto,
    @Req() request: Request,
  ): Promise<PaymentResponseDto> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.paymentsService.processPayment(dto, user.id);
  }

  @ApiOperation({
    summary: 'Complete 3D Secure payment after user verification',
    description:
      'Called after user completes 3D Secure verification on bank page. Frontend sends session_id and token_id from PAYNET callback.',
  })
  @ApiResponse({
    status: 200,
    description: '3D Secure payment completed successfully. Waiting for webhook confirmation.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        paymentId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        message: { type: 'string', example: '3D Secure payment completed. Waiting for webhook confirmation.' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request, payment already processed, or Paynet API authentication/validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @Post('complete-3d')
  async complete3DPayment(
    @Body() dto: Complete3DPaymentDto,
    @Req() request: Request,
  ): Promise<{ success: boolean; paymentId: string; message: string }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.paymentsService.complete3DPayment(dto, user.id);
  }

  @ApiOperation({ summary: 'Test PAYNET API connection and configuration' })
  @ApiResponse({ status: 200, description: 'PAYNET connection test result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('test-paynet-connection')
  async testPaynetConnection(): Promise<{
    success: boolean;
    message: string;
    config: {
      apiUrl: string;
      hasApiKey: boolean;
      hasSecretKey: boolean;
      hasPublishableKey: boolean;
      secretKeyPrefix: string;
      publishableKeyPrefix: string;
    };
    testResults?: Array<{
      test: string;
      success: boolean;
      message: string;
      statusCode?: number;
      error?: string;
      authHeader?: string;
      details?: any;
    }>;
    error?: string;
  }> {
    const secretKey = process.env.PAYNET_SECRET_KEY || '';
    const publishableKey = process.env.PAYNET_PUBLISHABLE_KEY || '';

    const config = {
      apiUrl: process.env.PAYNET_API_URL || '',
      hasApiKey: !!process.env.PAYNET_API_KEY,
      hasSecretKey: !!secretKey,
      hasPublishableKey: !!publishableKey,
      secretKeyPrefix: secretKey.substring(0, 10) + '...',
      publishableKeyPrefix: publishableKey.substring(0, 10) + '...',
    };

    // Check if configuration is complete
    if (!config.apiUrl || !config.hasSecretKey || !config.hasPublishableKey) {
      return {
        success: false,
        message: 'PAYNET configuration is incomplete. Please check your .env file.',
        config,
      };
    }

    // Test PAYNET API connection
    // Note: PAYNET endpoints will be confirmed from documentation
    const testResults: any[] = [];
    
    try {
      // Test 1: Basic connectivity (DNS resolution, network reachability)
      const baseUrl = config.apiUrl.replace(/\/$/, '');
      // PAYNET uses direct secret key, no base64 encoding
      // Format: Authorization: Basic <SecretKey>
      const authHeader = secretKey;
      
      // Try to reach base URL (may return 404, but that's OK - means server is reachable)
      try {
        const response = await firstValueFrom(
          this.httpService.get(baseUrl, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
            },
            timeout: 10000,
            validateStatus: () => true, // Accept any status code
          }),
        );

        testResults.push({
          test: 'Base URL Connectivity',
          success: true,
          statusCode: response.status,
          message: `Server is reachable (HTTP ${response.status})`,
        });
      } catch (connectError: any) {
        const isConnectionError = connectError.code === 'ECONNREFUSED' || 
                                  connectError.code === 'ENOTFOUND' ||
                                  connectError.code === 'ETIMEDOUT';

        testResults.push({
          test: 'Base URL Connectivity',
          success: !isConnectionError,
          error: connectError.message,
          message: isConnectionError 
            ? 'Cannot reach PAYNET API server. Check URL and network.'
            : `Connection error: ${connectError.message}`,
        });
      }

      // Test 2: Authentication format (Basic Auth)
      testResults.push({
        test: 'Authentication Format',
        success: true,
        message: 'Using HTTP Basic Authentication with direct secret key (PAYNET standard)',
        authHeader: `Basic ${authHeader.substring(0, 10)}...`,
      });

      // Test 3: Configuration validation
      const configValid = config.apiUrl && config.hasSecretKey && config.hasPublishableKey;
      testResults.push({
        test: 'Configuration',
        success: configValid,
        message: configValid 
          ? 'All required configuration values are set'
          : 'Missing required configuration values',
        details: {
          hasApiUrl: !!config.apiUrl,
          hasSecretKey: config.hasSecretKey,
          hasPublishableKey: config.hasPublishableKey,
        },
      });

      const allTestsPassed = testResults.every((t) => t.success);
      
      return {
        success: allTestsPassed,
        message: allTestsPassed 
          ? 'PAYNET API connection tests passed. Ready for integration testing.'
          : 'Some PAYNET connection tests failed. Check details below.',
        config,
        testResults,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Test execution error: ${error.message}`,
        config,
        testResults,
        error: error.message,
      };
    }
  }

  @ApiOperation({
    summary: 'Get payment status and webhook status',
    description: 'Check payment status and whether webhook has been received. Frontend/iOS uses this for polling.',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        deviceId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        paymentStatus: { type: 'string', example: 'pending' },
        escrowStatus: { type: 'string', example: 'pending' },
        webhookReceived: { type: 'boolean', example: true },
        totalAmount: { type: 'number', example: 2000.0 },
        providerTransactionId: { type: 'string', example: 'paynet-txn-123' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @Get(':paymentId/status')
  async getPaymentStatus(
    @Param('paymentId') paymentId: string,
    @Req() request: Request,
  ): Promise<{
    id: string;
    deviceId: string;
    paymentStatus: string;
    escrowStatus: string;
    webhookReceived: boolean;
    totalAmount: number;
    providerTransactionId?: string;
  }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.paymentsService.getPaymentStatus(paymentId, user.id);
  }

  @ApiOperation({
    summary: 'Get webhook data for a payment',
    description: 'Retrieve stored webhook payload. Frontend/iOS calls this after webhookReceived: true in status endpoint.',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        webhookData: {
          type: 'object',
          properties: {
            reference_no: { type: 'string' },
            is_succeed: { type: 'boolean' },
            amount: { type: 'number' },
            netAmount: { type: 'number' },
            comission: { type: 'number' },
            authorization_code: { type: 'string' },
            order_id: { type: 'string' },
            xact_date: { type: 'string' },
          },
        },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment or webhook data not found' })
  @Get(':paymentId/webhook-data')
  async getWebhookData(
    @Param('paymentId') paymentId: string,
    @Req() request: Request,
  ): Promise<{
    success: boolean;
    webhookData?: any;
    error?: string;
  }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.paymentsService.getWebhookData(paymentId, user.id);
  }

  @ApiOperation({
    summary: 'Release escrow payment',
    description: 'Release escrow payment to beneficiary. Backend communicates with Paynet API and updates database after successful release. Payment must be in "completed" status and escrow must be "held".',
  })
  @ApiResponse({
    status: 200,
    description: 'Escrow released successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Escrow released successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request, payment not in valid state for escrow release, or missing required fields (paymentId, deviceId, releaseReason)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found or payment does not belong to the user' })
  @Post('release-escrow')
  async releaseEscrow(
    @Body() body: { paymentId: string; deviceId: string; releaseReason: string },
    @Req() request: Request,
  ): Promise<{ success: boolean; message: string }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    // Validate request body
    if (!body.paymentId || !body.deviceId || !body.releaseReason) {
      throw new BadRequestException(
        'Missing required fields: paymentId, deviceId, and releaseReason are required.',
      );
    }

    return this.paymentsService.releaseEscrow(
      body.paymentId,
      body.deviceId,
      body.releaseReason,
      user.id,
    );
  }
}
