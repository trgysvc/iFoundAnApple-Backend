import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { SubmitCargoTrackingDto } from './dto/submit-cargo-tracking.dto';

/**
 * Cargo shipments today have no real carrier integration: no API, no
 * webhooks, no live tracking. Ops books the shipment with a carrier of
 * their choice outside this system and enters the resulting tracking
 * number here. This service exists to record that manual step so the
 * app can show the finder's delivery code and the owner's tracking
 * number, and to let the owner self-report physical receipt since no
 * carrier will ever tell us that automatically.
 */
@Injectable()
export class CargoService {
  private readonly logger = new Logger(CargoService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async listShipments(): Promise<any[]> {
    const { data: shipments, error } = await this.supabase
      .from('cargo_shipments')
      .select(
        'id, device_id, payment_id, cargo_company, tracking_number, status, cargo_status, code, cargo_fee, created_at, updated_at, picked_up_at, delivered_at',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      this.logger.error(`Failed to list cargo shipments: ${error.message}`, error);
      throw new BadRequestException('Failed to list cargo shipments');
    }

    if (!shipments || shipments.length === 0) {
      return [];
    }

    const deviceIds = [...new Set(shipments.map((s) => s.device_id))];
    const { data: devices } = await this.supabase
      .from('devices')
      .select('id, model, serialNumber')
      .in('id', deviceIds);

    const deviceById = new Map((devices || []).map((d) => [d.id, d]));

    return shipments.map((shipment) => ({
      ...shipment,
      device: deviceById.get(shipment.device_id) || null,
    }));
  }

  /**
   * Ops enters the real tracking number after booking the shipment with a
   * carrier directly (their own account, outside this app). This moves
   * both the owner's and the finder's device rows to 'cargo_shipped'.
   */
  async submitTracking(deviceId: string, dto: SubmitCargoTrackingDto): Promise<{ success: boolean }> {
    const { data: shipment, error: findError } = await this.supabase
      .from('cargo_shipments')
      .select('id')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !shipment) {
      throw new NotFoundException(
        'No cargo shipment found for this device. Payment must be completed first.',
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await this.supabase
      .from('cargo_shipments')
      .update({
        cargo_company: dto.cargoCompany,
        tracking_number: dto.trackingNumber,
        status: 'picked_up',
        cargo_status: 'picked_up',
        picked_up_at: now,
        used_at: now,
        updated_at: now,
      })
      .eq('id', shipment.id);

    if (updateError) {
      this.logger.error(`Failed to update cargo shipment: ${updateError.message}`, updateError);
      throw new BadRequestException('Failed to update cargo shipment');
    }

    const { ownerDevice, finderDevice } = await this.updateDevicePairStatus(deviceId, 'cargo_shipped');

    if (ownerDevice?.user_id) {
      await this.notify(ownerDevice.user_id, 'package_in_transit', deviceId);
    }
    if (finderDevice?.user_id) {
      await this.notify(finderDevice.user_id, 'package_shipped', deviceId);
    }

    return { success: true };
  }

  /**
   * Owner self-reports that the physical package has arrived. There is no
   * carrier webhook to detect this automatically, so this is the only
   * signal the system has.
   */
  async markReceived(deviceId: string, userId: string): Promise<{ success: boolean }> {
    const { data: ownerDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, user_id, device_role, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (deviceError || !ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    if (ownerDevice.device_role !== 'owner' || ownerDevice.user_id !== userId) {
      throw new ForbiddenException('Only the device owner can confirm receipt');
    }

    const now = new Date().toISOString();

    const { error: shipmentError } = await this.supabase
      .from('cargo_shipments')
      .update({ status: 'delivered', cargo_status: 'delivered', delivered_at: now, updated_at: now })
      .eq('device_id', deviceId);

    if (shipmentError) {
      this.logger.error(`Failed to update shipment as delivered: ${shipmentError.message}`, shipmentError);
    }

    const { error: deviceUpdateError } = await this.supabase
      .from('devices')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', deviceId);

    if (deviceUpdateError) {
      this.logger.error(`Failed to update device status: ${deviceUpdateError.message}`, deviceUpdateError);
      throw new BadRequestException('Failed to update device status');
    }

    const { data: finderDevice } = await this.supabase
      .from('devices')
      .select('user_id')
      .eq('serialNumber', ownerDevice.serialNumber)
      .eq('model', ownerDevice.model)
      .eq('device_role', 'finder')
      .maybeSingle();

    if (finderDevice?.user_id) {
      await this.notify(finderDevice.user_id, 'package_delivered_confirm', deviceId);
    }

    return { success: true };
  }

  private async updateDevicePairStatus(
    deviceId: string,
    status: string,
  ): Promise<{ ownerDevice: any; finderDevice: any }> {
    const now = new Date().toISOString();

    const { data: ownerDevice } = await this.supabase
      .from('devices')
      .select('id, user_id, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (!ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    await this.supabase.from('devices').update({ status, updated_at: now }).eq('id', deviceId);

    const { data: finderDevice } = await this.supabase
      .from('devices')
      .select('id, user_id')
      .eq('serialNumber', ownerDevice.serialNumber)
      .eq('model', ownerDevice.model)
      .eq('device_role', 'finder')
      .maybeSingle();

    if (finderDevice) {
      await this.supabase
        .from('devices')
        .update({ status, updated_at: now })
        .eq('id', finderDevice.id);
    }

    return { ownerDevice, finderDevice };
  }

  private async notify(userId: string, messageKey: string, deviceId: string): Promise<void> {
    const { error } = await this.supabase.from('notifications').insert({
      user_id: userId,
      message_key: messageKey,
      type: 'info',
      is_read: false,
      link: `device/${deviceId}`,
    });

    if (error) {
      this.logger.error(`Failed to create notification (${messageKey}): ${error.message}`, error);
    }
  }
}
