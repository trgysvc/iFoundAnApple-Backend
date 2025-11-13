import { Body, Controller, Headers, Ip, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly paynetAllowedIPs: string[];

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {
    // PAYNET Static IPs from integration settings
    // Can be configured via PAYNET_ALLOWED_IPS env var (comma-separated)
    const envIPs = process.env.PAYNET_ALLOWED_IPS;
    this.paynetAllowedIPs = envIPs
      ? envIPs.split(',').map((ip) => ip.trim())
      : ['104.21.232.181', '172.67.202.100']; // Default IPs from PAYNET dashboard
  }

  @ApiOperation({ 
    summary: 'PAYNET payment callback webhook (confirmation_url)',
    description: 'PAYNET sends payment confirmation to this endpoint. Payload includes reference_no, is_succeed, amount, and other transaction details.'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature or payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized IP address' })
  @Post('paynet-callback')
  async handlePaynetCallback(
    @Body() payload: any,
    @Ip() clientIp: string,
    @Req() request: Request,
    @Headers('x-paynet-signature') signature?: string,
    @Headers('x-paynet-timestamp') timestamp?: string,
  ): Promise<{ received: boolean }> {
    // Verify IP address (additional security layer)
    const requestIp = this.getClientIp(request, clientIp);
    if (!this.isAllowedIP(requestIp)) {
      throw new UnauthorizedException(`Unauthorized IP address: ${requestIp}`);
    }

    await this.webhooksService.handlePaynetWebhook(
      payload,
      signature || '',
      timestamp || '',
    );
    return { received: true };
  }

  private getClientIp(request: Request, fallbackIp: string): string {
    // Check for forwarded IP (if behind proxy/load balancer)
    const forwardedFor = request.headers['x-forwarded-for'] as string;
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'] as string;
    if (realIp) {
      return realIp;
    }

    return fallbackIp;
  }

  private isAllowedIP(ip: string): boolean {
    // In development, allow localhost
    if (process.env.NODE_ENV === 'development') {
      if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return true;
      }
    }

    return this.paynetAllowedIPs.includes(ip);
  }
}

