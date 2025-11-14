import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AppConfiguration } from '../../config/configuration';

interface PaynetConfig {
  apiUrl: string;
  apiKey: string;
  secretKey: string;
  publishableKey: string;
}

/**
 * PAYNET 3D ile Ödeme Request (3D Secure payment)
 * Based on: https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme
 * 
 * Endpoint: POST /v2/transaction/tds_initial
 * 
 * Field names use snake_case format (PAYNET standard)
 */
interface Paynet3DPaymentRequest {
  amount: number; // Çekilecek tutar
  reference_no: string; // İşleme ait benzersiz referans numarası (order_id)
  return_url: string; // 3D doğrulama sonucunun post edileceği URL - ZORUNLU
  domain: string; // İşlemin yapıldığı uygulamanın domain bilgisi - ZORUNLU
  is_escrow?: boolean; // PAYNET escrow özelliği - ödeme ana firma onayına tabi olur
  // Kart bilgileri (saklı kart kullanılmıyorsa zorunlu)
  card_holder?: string; // Kart sahibi bilgisi
  pan?: string; // Kart numarası
  month?: string; // Son kullanma tarihi ay bilgisi (MM formatında)
  year?: string; // Son kullanma tarihi yıl bilgisi (YY veya YYYY formatında)
  cvc?: string; // CVV/CVC kodu
  // Opsiyonel parametreler
  description?: string;
  installments?: number; // Taksit sayısı
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
}

/**
 * PAYNET 3D Ödeme Başlatma Response
 */
interface Paynet3DPaymentResponse {
  success: boolean;
  transaction_id?: string;
  session_id?: string;
  post_url?: string; // 3D doğrulama sayfası URL'i
  html_content?: string; // 3D doğrulama HTML içeriği
  error?: string;
  message?: string;
}

/**
 * PAYNET 3D Ödeme Tamamlama Request
 * 3D doğrulama sonrası return_url'den gelen session_id ve token_id ile
 * 
 * Endpoint: POST /v2/transaction/tds_charge
 * 
 * Field names use snake_case format (PAYNET standard)
 */
interface Paynet3DCompleteRequest {
  session_id: string; // 3D ödeme akışının oturum bilgisi - ZORUNLU
  token_id: string; // İşlemin token bilgisi - ZORUNLU
  transaction_type?: number; // İşlem tipi: 1 = Satış, 3 = Ön provizyon (varsayılan: 1)
}

/**
 * PAYNET Ödeme Response (3D'siz veya 3D tamamlama sonrası)
 */
interface PaynetPaymentResponse {
  success: boolean;
  transaction_id?: string;
  status?: string;
  error?: string;
  message?: string;
}

@Injectable()
export class PaynetProvider {
  private readonly logger = new Logger(PaynetProvider.name);
  private readonly config: PaynetConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {
    this.config = {
      apiUrl: process.env.PAYNET_API_URL || '',
      apiKey: process.env.PAYNET_API_KEY || '',
      secretKey: process.env.PAYNET_SECRET_KEY || '',
      publishableKey: process.env.PAYNET_PUBLISHABLE_KEY || '',
    };

    if (!this.config.apiUrl || !this.config.secretKey) {
      this.logger.warn(
        'PAYNET configuration incomplete. Payment processing will fail.',
      );
    }

    // PAYNET uses secret_key for authentication, not API key
    // API key might be optional depending on PAYNET's implementation
    if (!this.config.secretKey) {
      this.logger.error('PAYNET_SECRET_KEY is required for API authentication');
    }

    if (!this.config.publishableKey) {
      this.logger.warn(
        'PAYNET publishable key not set. Frontend payment integration may fail.',
      );
    }
  }

  /**
   * Initiate 3D Secure payment with PAYNET
   * Based on: https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme
   * Returns post_url or html_content for 3D Secure verification
   * 
   * PAYNET API Base URLs:
   * - Test: https://pts-api.paynet.com.tr
   * - Production: https://api.paynet.com.tr
   * 
   * Endpoint: POST /v2/transaction/tds_initial
   * Note: 3D payment endpoints use /v2/ prefix, escrow endpoints use /v1/
   */
  async initiate3DPayment(
    request: Paynet3DPaymentRequest,
  ): Promise<Paynet3DPaymentResponse> {
    try {
      // PAYNET API endpoint for 3D Secure payment
      // Endpoint: POST /v2/transaction/tds_initial
      const baseUrl = this.config.apiUrl.replace(/\/v[12]\/?$/, ''); // Remove /v1 or /v2 if exists
      const endpoint = `${baseUrl}/v2/transaction/tds_initial`;
      
      this.logger.log(`Initiating 3D payment: ${endpoint}`);
      this.logger.debug(`Payment request: ${JSON.stringify({ ...request, pan: '***', cvc: '***' })}`);

      // Debug: Check if secret key is loaded
      if (!this.config.secretKey) {
        this.logger.error('PAYNET_SECRET_KEY is not loaded from environment variables');
        throw new InternalServerErrorException('PAYNET configuration error: secret key not found');
      }
      
      // Debug: Log secret key prefix (first 10 chars) for verification
      this.logger.debug(`PAYNET Secret Key prefix: ${this.config.secretKey.substring(0, 10)}...`);
      this.logger.debug(`PAYNET API URL: ${this.config.apiUrl}`);

      // PAYNET uses HTTP Basic Authentication
      // According to PAYNET docs: Authorization: Basic [Secret Key]
      // Format: Authorization: Basic base64(secret_key:)
      // Note: Standard Basic Auth format requires base64 encoding of "username:password"
      // For PAYNET, secret_key is used as username with empty password
      const authHeader = Buffer.from(`${this.config.secretKey}:`).toString('base64');
      
      // Debug: Log auth header prefix (first 30 chars) for verification
      this.logger.debug(`Authorization header prefix: Basic ${authHeader.substring(0, 30)}...`);
      
      const response = await firstValueFrom(
        this.httpService.post<Paynet3DPaymentResponse>(
          endpoint,
          request,
          {
            headers: {
              'Authorization': `Basic ${authHeader}`, // PAYNET uses Basic Auth with base64(secret_key:)
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response.data.success) {
        this.logger.error(
          `PAYNET 3D payment initiation failed: ${response.data.error || response.data.message}`,
        );
        throw new InternalServerErrorException(
          `Payment initiation failed: ${response.data.error || response.data.message}`,
        );
      }

      this.logger.log(`3D payment initiated: transaction_id=${response.data.transaction_id}, session_id=${response.data.session_id}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`PAYNET API error: ${error.message}`, error.stack);
      
      if (error.response) {
        this.logger.error(`PAYNET API response: ${JSON.stringify(error.response.data)}`);
        throw new InternalServerErrorException(
          `Payment provider error: ${error.response.data?.message || error.message}`,
        );
      }
      
      throw new InternalServerErrorException(
        `Payment provider error: ${error.message}`,
      );
    }
  }

  /**
   * Complete 3D Secure payment after verification
   * Called after user completes 3D verification on bank's page
   * Based on: https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme
   * 
   * Endpoint: POST /v2/transaction/tds_charge
   * Note: Uses session_id and token_id from return_url callback
   */
  async complete3DPayment(
    request: Paynet3DCompleteRequest,
  ): Promise<PaynetPaymentResponse> {
    try {
      // PAYNET API endpoint for completing 3D payment
      // Endpoint: POST /v2/transaction/tds_charge
      const baseUrl = this.config.apiUrl.replace(/\/v[12]\/?$/, ''); // Remove /v1 or /v2 if exists
      const endpoint = `${baseUrl}/v2/transaction/tds_charge`;
      
      this.logger.log(`Completing 3D payment: session_id=${request.session_id}`);

      // PAYNET uses HTTP Basic Authentication with secret_key
      const authHeader = Buffer.from(`${this.config.secretKey}:`).toString('base64');
      
      const response = await firstValueFrom(
        this.httpService.post<PaynetPaymentResponse>(
          endpoint,
          request,
          {
            headers: {
              'Authorization': `Basic ${authHeader}`, // PAYNET uses Basic Auth
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response.data.success) {
        this.logger.error(
          `PAYNET 3D payment completion failed: ${response.data.error || response.data.message}`,
        );
        throw new InternalServerErrorException(
          `Payment completion failed: ${response.data.error || response.data.message}`,
        );
      }

      this.logger.log(`3D payment completed: transaction_id=${response.data.transaction_id}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`PAYNET API error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Payment completion error: ${error.message}`,
      );
    }
  }

  /**
   * Get publishable key for frontend integration
   * This key can be safely exposed to frontend
   */
  getPublishableKey(): string {
    return this.config.publishableKey;
  }

  /**
   * Verify webhook signature from PAYNET
   * Uses Secret Key for HMAC-SHA256 signature verification
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
  ): boolean {
    // TODO: Implement PAYNET signature verification
    // This is CRITICAL for security - never skip this step
    // PAYNET typically uses HMAC-SHA256 with secret key
    // Example: HMAC-SHA256(payload + timestamp, secretKey) === signature
    this.logger.warn('Webhook signature verification not yet implemented');
    return true; // Temporary - MUST be implemented before production
  }

  /**
   * Release escrow payment (Escrow Durum Güncelleme)
   * PAYNET escrow'da tutulan ödemeyi serbest bırakır
   * Based on: https://doc.paynet.com.tr/servisler/islem/escrow-durum-guncelleme
   * 
   * Status values:
   * - 2: Onay (Approve/Release)
   * - 3: Red (Reject)
   */
  async releaseEscrowPayment(
    xactId: string,
    note?: string,
  ): Promise<PaynetPaymentResponse> {
    try {
      // PAYNET API endpoint for escrow status update
      // Endpoint: /v1/transaction/escrow_status_update
      const baseUrl = this.config.apiUrl.replace(/\/v1\/?$/, ''); // Remove /v1 if exists
      const endpoint = `${baseUrl}/v1/transaction/escrow_status_update`;
      
      this.logger.log(`Releasing escrow payment: xact_id=${xactId}`);

      const authHeader = Buffer.from(`${this.config.secretKey}:`).toString('base64');
      
      const requestBody: {
        xact_id: string;
        status: number;
        note?: string;
      } = {
        xact_id: xactId,
        status: 2, // 2 = Onay (Approve/Release)
      };

      if (note && note.length <= 256) {
        requestBody.note = note;
      }

      const response = await firstValueFrom(
        this.httpService.post<PaynetPaymentResponse>(
          endpoint,
          requestBody,
          {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response.data.success) {
        this.logger.error(
          `PAYNET escrow release failed: ${response.data.error || response.data.message}`,
        );
        throw new InternalServerErrorException(
          `Escrow release failed: ${response.data.error || response.data.message}`,
        );
      }

      this.logger.log(`Escrow payment released: xact_id=${xactId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`PAYNET escrow release error: ${error.message}`, error.stack);
      
      if (error.response) {
        this.logger.error(`PAYNET API response: ${JSON.stringify(error.response.data)}`);
      }
      
      throw new InternalServerErrorException(
        `Escrow release error: ${error.message}`,
      );
    }
  }

  /**
   * Reject escrow payment (Escrow Red)
   * PAYNET escrow'da tutulan ödemeyi reddeder
   * Based on: https://doc.paynet.com.tr/servisler/islem/escrow-durum-guncelleme
   */
  async rejectEscrowPayment(
    xactId: string,
    note?: string,
  ): Promise<PaynetPaymentResponse> {
    try {
      const baseUrl = this.config.apiUrl.replace(/\/v1\/?$/, '');
      const endpoint = `${baseUrl}/v1/transaction/escrow_status_update`;
      
      this.logger.log(`Rejecting escrow payment: xact_id=${xactId}`);

      const authHeader = Buffer.from(`${this.config.secretKey}:`).toString('base64');
      
      const requestBody: {
        xact_id: string;
        status: number;
        note?: string;
      } = {
        xact_id: xactId,
        status: 3, // 3 = Red (Reject)
      };

      if (note && note.length <= 256) {
        requestBody.note = note;
      }

      const response = await firstValueFrom(
        this.httpService.post<PaynetPaymentResponse>(
          endpoint,
          requestBody,
          {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response.data.success) {
        this.logger.error(
          `PAYNET escrow rejection failed: ${response.data.error || response.data.message}`,
        );
        throw new InternalServerErrorException(
          `Escrow rejection failed: ${response.data.error || response.data.message}`,
        );
      }

      this.logger.log(`Escrow payment rejected: xact_id=${xactId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`PAYNET escrow rejection error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Escrow rejection error: ${error.message}`,
      );
    }
  }

  /**
   * Get payment status from PAYNET
   * Based on PAYNET API documentation
   * 
   * Note: Transaction query endpoint dokümantasyondan doğrulanacak
   * Tahmini: GET /v1/transaction/{xact_id} veya GET /v2/transaction/{xact_id}
   */
  async getPaymentStatus(xactId: string): Promise<any> {
    try {
      // PAYNET API endpoint for status check
      // Endpoint format dokümantasyondan doğrulanacak
      const baseUrl = this.config.apiUrl.replace(/\/v[12]\/?$/, ''); // Remove /v1 or /v2 if exists
      const endpoint = `${baseUrl}/v1/transaction/${xactId}`; // v1 veya v2 olabilir, dokümantasyondan doğrulanacak
      
      // PAYNET uses HTTP Basic Authentication with secret_key
      const authHeader = Buffer.from(`${this.config.secretKey}:`).toString('base64');
      
      const response = await firstValueFrom(
        this.httpService.get(
          endpoint,
          {
            headers: {
              'Authorization': `Basic ${authHeader}`, // PAYNET uses Basic Auth
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `PAYNET status check error: ${error.message}`,
        error.stack,
      );
      
      if (error.response) {
        this.logger.error(`PAYNET API response: ${JSON.stringify(error.response.data)}`);
      }
      
      throw new InternalServerErrorException(
        `Payment status check failed: ${error.message}`,
      );
    }
  }
}

