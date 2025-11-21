import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ 
    summary: 'PAYNET payment callback webhook (confirmation_url)',
    description: 'PAYNET sends payment confirmation to this endpoint. Payload includes reference_no, is_succeed, amount, and other transaction details.'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature or payload' })
  @Post('paynet-callback')
  async handlePaynetCallback(
    @Body() payload: any,
    @Req() request: Request,
    @Headers('x-paynet-signature') signature?: string,
    @Headers('x-paynet-timestamp') timestamp?: string,
  ): Promise<{ received: boolean }> {
    await this.webhooksService.handlePaynetWebhook(
      payload,
      signature || '',
      timestamp || '',
    );
    return { received: true };
  }
}

