import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppConfiguration } from '../../config/configuration';
import { SupabaseService } from '../../supabase/supabase.service';
import { FeeCalculationResult } from '../dto/fee-calculation.dto';

interface DeviceWithModel {
  id: string;
  model: string;
  status: string;
  userId: string;
  device_models?: {
    ifoundanapple_fee: number;
  };
}

@Injectable()
export class FeeValidationService {
  private readonly logger = new Logger(FeeValidationService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Calculate fees based on device model's ifoundanapple_fee from database
   * This is the CRITICAL security step - never trust frontend amounts
   */
  async calculateFees(deviceId: string): Promise<FeeCalculationResult> {
    const device = await this.getDeviceWithModel(deviceId);

    if (!device.device_models?.ifoundanapple_fee) {
      throw new NotFoundException(
        `Device model fee not found for device: ${deviceId}`,
      );
    }

    const totalAmount = Number(device.device_models.ifoundanapple_fee);
    const gatewayFee = totalAmount * 0.0343;
    const cargoFee = 250.0;
    const rewardAmount = totalAmount * 0.2;
    const serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount;
    const netPayout = rewardAmount;

    return {
      totalAmount,
      gatewayFee,
      cargoFee,
      rewardAmount,
      serviceFee,
      netPayout,
    };
  }

  /**
   * Validate that frontend amount matches backend calculation
   * Throws BadRequestException if amounts don't match
   */
  async validateAmount(
    deviceId: string,
    frontendAmount: number,
  ): Promise<FeeCalculationResult> {
    const calculatedFees = await this.calculateFees(deviceId);

    const tolerance = 0.01;
    const amountDifference = Math.abs(
      calculatedFees.totalAmount - frontendAmount,
    );

    if (amountDifference > tolerance) {
      this.logger.warn(
        `Amount mismatch for device ${deviceId}: frontend=${frontendAmount}, calculated=${calculatedFees.totalAmount}`,
      );
      throw new BadRequestException(
        `Amount mismatch. Expected: ${calculatedFees.totalAmount}, Received: ${frontendAmount}`,
      );
    }

    return calculatedFees;
  }

  private async getDeviceWithModel(deviceId: string): Promise<DeviceWithModel> {
    const { data: device, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, model, status, userId')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      this.logger.error(`Device not found: ${deviceId}`, deviceError);
      throw new NotFoundException(`Device not found: ${deviceId}`);
    }

    const { data: deviceModel, error: modelError } = await this.supabase
      .from('device_models')
      .select('ifoundanapple_fee')
      .eq('model', device.model)
      .single();

    if (modelError || !deviceModel) {
      this.logger.error(`Device model not found: ${device.model}`, modelError);
      throw new NotFoundException(`Device model not found: ${device.model}`);
    }

    return {
      ...device,
      device_models: {
        ifoundanapple_fee: Number(deviceModel.ifoundanapple_fee),
      },
    };
  }
}

