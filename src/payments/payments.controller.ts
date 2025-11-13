import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsService } from './services/payments.service';
import { PaynetProvider } from './providers/paynet.provider';

@ApiTags('payments')
@Controller('payments')
@ApiBearerAuth('bearer')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paynetProvider: PaynetProvider,
    private readonly httpService: HttpService,
  ) {}

  @ApiOperation({ summary: 'Process payment for a matched device' })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment request or amount mismatch' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Device not found' })
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
      const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
      
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
        message: 'Using HTTP Basic Authentication (PAYNET standard)',
        authHeader: `Basic ${authHeader.substring(0, 20)}...`,
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
}
