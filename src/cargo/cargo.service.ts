import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { PaymentsService } from '../payments/services/payments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SubmitCargoTrackingDto } from './dto/submit-cargo-tracking.dto';
import { CargoAdminStatus, UpdateCargoStatusDto } from './dto/update-cargo-status.dto';

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

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly paymentsService: PaymentsService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  async listShipments(): Promise<any[]> {
    const { data: shipments, error } = await this.supabase
      .from('cargo_shipments')
      .select(
        'id, device_id, payment_id, cargo_company, tracking_number, status, cargo_status, code, cargo_fee, notes, created_at, updated_at, picked_up_at, delivered_at',
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
      .select('id, model, serialNumber, status')
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

    if (ownerDevice?.userId) {
      await this.notify(ownerDevice.userId, 'package_in_transit', deviceId);
    }
    if (finderDevice?.userId) {
      await this.notify(finderDevice.userId, 'package_shipped', deviceId);
    }

    return { success: true };
  }

  /**
   * Ops advances a shipment's status as reported by the carrier (phone,
   * carrier tracking page, etc — no carrier API is integrated). Carrier
   * name / tracking number are optional and can be attached at any step.
   *
   * This is distinct from `markReceived`: this records what the carrier
   * says happened to the package, moving devices.status to 'delivered'
   * once the carrier reports drop-off. Only the owner's own confirmation
   * via `markReceived` (devices.status → 'confirmed') triggers payout —
   * this method never does that on its own.
   */
  async updateStatus(deviceId: string, dto: UpdateCargoStatusDto): Promise<{ success: boolean }> {
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
    const cargoStatus = this.toCargoStatus(dto.status);

    const update: Record<string, unknown> = {
      status: dto.status,
      cargo_status: cargoStatus,
      updated_at: now,
    };
    if (dto.cargoCompany) update.cargo_company = dto.cargoCompany;
    if (dto.trackingNumber) update.tracking_number = dto.trackingNumber;
    if (dto.note) update.notes = dto.note;
    if (dto.status === 'picked_up') {
      update.picked_up_at = now;
      update.used_at = now;
    }
    if (dto.status === 'delivered') {
      update.delivered_at = now;
    }
    if (dto.status === 'failed_delivery' && dto.note) {
      update.failure_reason = dto.note;
    }

    const { error: updateError } = await this.supabase
      .from('cargo_shipments')
      .update(update)
      .eq('id', shipment.id);

    if (updateError) {
      this.logger.error(`Failed to update cargo shipment: ${updateError.message}`, updateError);
      throw new BadRequestException('Failed to update cargo shipment');
    }

    // devices.status follows the documented DeviceStatus enum: 'picked_up'
    // moves the pair to 'cargo_shipped', and the carrier's final 'delivered'
    // report moves the pair to 'delivered' (owner hasn't confirmed yet —
    // that's a separate, later transition to 'confirmed' via markReceived).
    // in_transit/out_for_delivery are shipment-level tracking info only and
    // don't move devices.status.
    if (dto.status === 'picked_up') {
      const { ownerDevice, finderDevice } = await this.updateDevicePairStatus(deviceId, 'cargo_shipped');
      if (ownerDevice?.userId) await this.notify(ownerDevice.userId, 'package_in_transit', deviceId);
      if (finderDevice?.userId) await this.notify(finderDevice.userId, 'package_shipped', deviceId);
    } else if (dto.status === 'delivered') {
      const { ownerDevice } = await this.updateDevicePairStatus(deviceId, 'delivered');
      if (ownerDevice?.userId) await this.notify(ownerDevice.userId, 'package_delivered_by_carrier', deviceId);
    } else if (dto.status === 'failed_delivery') {
      // Carrier attempted delivery to the owner and it failed (wrong address,
      // recipient absent, etc). Ops can retry (advance back to in_transit /
      // out_for_delivery) or escalate to 'returned' once it's clear the
      // package is going back to the finder.
      const { ownerDevice } = await this.updateDevicePairStatus(deviceId, 'failed_delivery');
      if (ownerDevice?.userId) await this.notify(ownerDevice.userId, 'delivery_failed', deviceId);
    } else if (dto.status === 'returned') {
      // Package is being sent back to the finder (after repeated failed
      // delivery, or the finder/owner backing out before pickup). This is
      // a terminal state for this shipment — no automatic refund logic
      // runs here, ops handles refunds manually per the cargo fee policy.
      const { ownerDevice, finderDevice } = await this.updateDevicePairStatus(deviceId, 'returned');
      if (ownerDevice?.userId) await this.notify(ownerDevice.userId, 'package_returned', deviceId);
      if (finderDevice?.userId) await this.notify(finderDevice.userId, 'package_returned_to_you', deviceId);
    } else if (dto.status === 'cancelled') {
      // Transaction cancelled before/during shipping, by a party or ops.
      // Terminal state — no further cargo status transitions expected.
      const { ownerDevice, finderDevice } = await this.updateDevicePairStatus(deviceId, 'cancelled');
      if (ownerDevice?.userId) await this.notify(ownerDevice.userId, 'shipment_cancelled', deviceId);
      if (finderDevice?.userId) await this.notify(finderDevice.userId, 'shipment_cancelled', deviceId);
    } else {
      const { data: ownerDevice } = await this.supabase
        .from('devices')
        .select('userId')
        .eq('id', deviceId)
        .maybeSingle();
      if (ownerDevice?.userId) {
        await this.notify(ownerDevice.userId, 'package_in_transit', deviceId);
      }
    }

    return { success: true };
  }

  /**
   * Owner cancels the transaction themselves while the device hasn't shipped
   * yet (cargo still 'created'/'pending', not 'picked_up' or later). Unlike
   * the admin-triggered 'cancelled' path in updateStatus() (which is for ops
   * handling exceptions after shipping and does not touch money), this
   * immediately refunds the held escrow to the owner via Paynet.
   */
  async cancelByOwner(deviceId: string, userId: string, reason: string): Promise<{ success: boolean }> {
    const { data: ownerDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (deviceError || !ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    if (ownerDevice.device_role !== 'owner' || ownerDevice.userId !== userId) {
      throw new ForbiddenException('Only the device owner can cancel this transaction');
    }

    const { data: shipment } = await this.supabase
      .from('cargo_shipments')
      .select('id, status, cargo_status')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const shippedStatuses = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
    if (shipment && shippedStatuses.includes(shipment.cargo_status)) {
      throw new BadRequestException(
        'Cargo has already shipped — this can no longer be self-cancelled. Contact support.',
      );
    }

    const { data: payment } = await this.supabase
      .from('payments')
      .select('id')
      .eq('device_id', deviceId)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment) {
      throw new NotFoundException('No completed payment found for this device');
    }

    // Refunds the held escrow via Paynet and sets the owner's device row to
    // 'cancelled' (see updateDatabaseAfterEscrowRefund in payments.service.ts).
    await this.paymentsService.cancelPaymentBeforeShipment(payment.id, deviceId, reason, userId);

    const now = new Date().toISOString();
    if (shipment) {
      await this.supabase
        .from('cargo_shipments')
        .update({ status: 'cancelled', cargo_status: 'cancelled', updated_at: now })
        .eq('id', shipment.id);
    }

    const { data: finderDevice } = await this.supabase
      .from('devices')
      .select('id, userId')
      .eq('serialNumber', ownerDevice.serialNumber)
      .eq('model', ownerDevice.model)
      .eq('device_role', 'finder')
      .maybeSingle();

    if (finderDevice) {
      await this.supabase
        .from('devices')
        .update({ status: 'cancelled', updated_at: now })
        .eq('id', finderDevice.id);

      if (finderDevice.userId) {
        await this.notify(finderDevice.userId, 'shipment_cancelled_by_owner', deviceId);
      }
    }

    return { success: true };
  }

  /**
   * payments.device_id always references the owner's device row, never the
   * finder's. The `devices`/`payments`/`cargo_shipments` tables are RLS-locked
   * to the owning user, so the finder's browser can never read the owner's
   * row (or the payment/cargo rows keyed off it) directly via the anon
   * client — this endpoint uses the service-role client to resolve the pair
   * and return the summary either side is allowed to see.
   */
  async getShipmentSummary(
    deviceId: string,
    userId: string,
  ): Promise<{ payment: any; escrow: any; cargoShipment: any }> {
    const { data: device, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      throw new NotFoundException('Device not found');
    }
    if (device.userId !== userId) {
      throw new ForbiddenException('Not authorized to view this device');
    }

    let paymentDeviceId = deviceId;
    if (device.device_role === 'finder') {
      const { data: ownerDevice } = await this.supabase
        .from('devices')
        .select('id')
        .eq('serialNumber', device.serialNumber)
        .eq('model', device.model)
        .eq('device_role', 'owner')
        .maybeSingle();
      if (ownerDevice?.id) {
        paymentDeviceId = ownerDevice.id;
      }
    }

    const { data: payment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('device_id', paymentDeviceId)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let escrow: any = null;
    let cargoShipment: any = null;

    if (payment) {
      const { data: escrowData } = await this.supabase
        .from('escrow_accounts')
        .select('*')
        .eq('payment_id', payment.id)
        .maybeSingle();
      escrow = escrowData || null;

      const { data: cargoData } = await this.supabase
        .from('cargo_shipments')
        .select('*')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cargoShipment = cargoData || null;
    }

    return { payment: payment || null, escrow, cargoShipment };
  }

  private toCargoStatus(status: CargoAdminStatus): string {
    // cargo_status has no 'out_for_delivery' value of its own; treat it as
    // still in transit for that simplified field.
    return status === 'out_for_delivery' ? 'in_transit' : status;
  }

  /**
   * Owner self-reports that the physical package has arrived. There is no
   * carrier webhook to detect this automatically, so this is the only
   * signal the system has.
   */
  async markReceived(deviceId: string, userId: string): Promise<{ success: boolean }> {
    const { data: ownerDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (deviceError || !ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    if (ownerDevice.device_role !== 'owner' || ownerDevice.userId !== userId) {
      throw new ForbiddenException('Only the device owner can confirm receipt');
    }

    return this.confirmReceipt(ownerDevice, 'package_delivered_confirm');
  }

  /**
   * Shared core of "the owner is treated as having confirmed receipt" —
   * used both by the owner's own manual confirmation (markReceived) and by
   * the 48-hour auto-confirm cron (autoConfirmStaleDeliveries). Moves both
   * device rows to 'confirmed', releases escrow (moving both to
   * 'completed' on success), and notifies the finder.
   */
  private async confirmReceipt(
    ownerDevice: { id: string; userId: string; model: string; serialNumber: string },
    finderNotifyKey: string,
  ): Promise<{ success: boolean }> {
    const deviceId = ownerDevice.id;
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
      .update({ status: 'confirmed', updated_at: now })
      .eq('id', deviceId);

    if (deviceUpdateError) {
      this.logger.error(`Failed to update device status: ${deviceUpdateError.message}`, deviceUpdateError);
      throw new BadRequestException('Failed to update device status');
    }

    const { data: finderDevice } = await this.supabase
      .from('devices')
      .select('id, userId')
      .eq('serialNumber', ownerDevice.serialNumber)
      .eq('model', ownerDevice.model)
      .eq('device_role', 'finder')
      .maybeSingle();

    if (finderDevice) {
      await this.supabase
        .from('devices')
        .update({ status: 'confirmed', updated_at: now })
        .eq('id', finderDevice.id);
    }

    if (finderDevice?.userId) {
      await this.notify(finderDevice.userId, finderNotifyKey, deviceId);
    }

    // Confirmation is the signal that releases the held payment to us
    // (Paynet settles escrowed funds to our merchant account, not directly
    // to the finder's IBAN — the finder's actual payout is a separate,
    // manual step outside this system). A failure here must not undo the
    // receipt confirmation itself; ops can retry the release manually via
    // the admin "Escrow Serbest Bırak" button if this fails.
    const { data: payment } = await this.supabase
      .from('payments')
      .select('id')
      .eq('device_id', deviceId)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment) {
      try {
        await this.paymentsService.releaseEscrow(
          payment.id,
          deviceId,
          'Device receipt confirmed',
          ownerDevice.userId,
        );
        // releaseEscrow only sets the owner's own device row to 'completed'
        // (it only knows the single deviceId it was called with) — mirror
        // that onto the finder's paired row so both sides reach the final
        // state instead of the finder staying stuck on 'confirmed' forever.
        if (finderDevice) {
          await this.supabase
            .from('devices')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', finderDevice.id);
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to auto-release escrow after receipt confirmation (payment ${payment.id}): ${err.message}`,
          err,
        );
      }
    } else {
      this.logger.error(`No completed payment found for device ${deviceId} — cannot auto-release escrow`);
    }

    return { success: true };
  }

  /**
   * Safety net for the finder: if the carrier reported delivery
   * (cargo_shipments.delivered_at) more than 48 hours ago and the owner has
   * neither confirmed nor disputed it, auto-confirm on their behalf so the
   * finder's reward isn't held hostage by an owner who never comes back.
   * Runs hourly; only ever touches devices still sitting at 'delivered'.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoConfirmStaleDeliveries(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: staleShipments, error } = await this.supabase
      .from('cargo_shipments')
      .select('device_id, delivered_at')
      .eq('cargo_status', 'delivered')
      .lt('delivered_at', cutoff);

    if (error) {
      this.logger.error(`autoConfirmStaleDeliveries: failed to query stale shipments: ${error.message}`, error);
      return;
    }
    if (!staleShipments || staleShipments.length === 0) {
      return;
    }

    for (const shipment of staleShipments) {
      try {
        const { data: ownerDevice } = await this.supabase
          .from('devices')
          .select('id, userId, device_role, model, serialNumber, status')
          .eq('id', shipment.device_id)
          .maybeSingle();

        // Only devices still waiting (owner hasn't confirmed or disputed,
        // and this hasn't already been auto-confirmed on a previous run).
        if (!ownerDevice || ownerDevice.device_role !== 'owner' || ownerDevice.status !== 'delivered') {
          continue;
        }

        this.logger.log(`Auto-confirming stale delivery for device ${ownerDevice.id} (delivered ${shipment.delivered_at})`);
        await this.confirmReceipt(ownerDevice, 'package_delivered_confirm_auto');
        if (ownerDevice.userId) {
          await this.notify(ownerDevice.userId, 'delivery_auto_confirmed', ownerDevice.id);
        }
      } catch (err: any) {
        this.logger.error(
          `autoConfirmStaleDeliveries: failed for device ${shipment.device_id}: ${err.message}`,
          err,
        );
      }
    }
  }

  /**
   * Owner disputes a carrier-reported delivery instead of confirming it
   * (wrong/damaged/missing device). Blocks escrow release — ops must
   * resolve the dispute (via `resolveDispute`) before anything else can
   * move devices.status off 'disputed'.
   */
  async disputeReceipt(deviceId: string, userId: string, reason: string): Promise<{ success: boolean }> {
    const { data: ownerDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (deviceError || !ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    if (ownerDevice.device_role !== 'owner' || ownerDevice.userId !== userId) {
      throw new ForbiddenException('Only the device owner can dispute receipt');
    }

    const now = new Date().toISOString();

    await this.supabase
      .from('cargo_shipments')
      .update({ notes: reason, updated_at: now })
      .eq('device_id', deviceId);

    const { finderDevice } = await this.updateDevicePairStatus(deviceId, 'disputed');

    if (finderDevice?.userId) {
      await this.notify(finderDevice.userId, 'delivery_disputed', deviceId);
    }

    return { success: true };
  }

  /**
   * Admin manually releases escrow for a device stuck at 'confirmed' (the
   * automatic release in markReceived/resolveDispute failed or hasn't run
   * yet). The public /payments/release-escrow endpoint requires the caller
   * to be the payment's payer or receiver, which an admin never is — so
   * this calls it internally using the owner's own userId, exactly as if
   * their confirmation had triggered it successfully the first time.
   */
  async adminReleaseEscrow(deviceId: string): Promise<{ success: boolean }> {
    const { data: ownerDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role, status')
      .eq('id', deviceId)
      .single();

    if (deviceError || !ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    if (ownerDevice.status !== 'confirmed') {
      throw new BadRequestException(
        `Device is not in a 'confirmed' state awaiting escrow release. Current status: ${ownerDevice.status}`,
      );
    }

    const { data: payment } = await this.supabase
      .from('payments')
      .select('id')
      .eq('device_id', deviceId)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment) {
      throw new NotFoundException('No completed payment found for this device');
    }

    await this.paymentsService.releaseEscrow(
      payment.id,
      deviceId,
      'Manual admin escrow release',
      ownerDevice.userId,
    );

    const { finderDevice } = await this.updateDevicePairStatus(deviceId, 'completed');
    if (finderDevice) {
      await this.supabase
        .from('devices')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', finderDevice.id);
    }

    return { success: true };
  }

  /**
   * Ops resolves a dispute after investigating outside the system (phone,
   * photos, etc). 'confirmed' proceeds as if the owner had confirmed
   * receipt normally; 'returned' sends the device back to the finder.
   */
  async resolveDispute(deviceId: string, resolution: 'confirmed' | 'returned'): Promise<{ success: boolean }> {
    const { data: ownerDevice, error: deviceError } = await this.supabase
      .from('devices')
      .select('id, userId, device_role, model, serialNumber, status')
      .eq('id', deviceId)
      .single();

    if (deviceError || !ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    if (ownerDevice.status !== 'disputed') {
      throw new BadRequestException('Device is not currently in a disputed state');
    }

    const { ownerDevice: updatedOwner, finderDevice } = await this.updateDevicePairStatus(deviceId, resolution);

    const now = new Date().toISOString();
    if (resolution === 'returned') {
      await this.supabase
        .from('cargo_shipments')
        .update({ status: 'returned', cargo_status: 'returned', updated_at: now })
        .eq('device_id', deviceId);
    } else if (updatedOwner?.userId) {
      // Resolving as 'confirmed' proceeds as if the owner had confirmed
      // receipt normally — release the held payment to us the same way
      // markReceived does.
      const { data: payment } = await this.supabase
        .from('payments')
        .select('id')
        .eq('device_id', deviceId)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (payment) {
        try {
          await this.paymentsService.releaseEscrow(
            payment.id,
            deviceId,
            'Dispute resolved as confirmed receipt',
            updatedOwner.userId,
          );
          // Same as markReceived: releaseEscrow only advances the owner's
          // own row to 'completed', mirror it onto the finder's paired row.
          if (finderDevice) {
            await this.supabase
              .from('devices')
              .update({ status: 'completed', updated_at: now })
              .eq('id', finderDevice.id);
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to auto-release escrow after dispute resolution (payment ${payment.id}): ${err.message}`,
            err,
          );
        }
      }
    }

    if (updatedOwner?.userId) {
      await this.notify(
        updatedOwner.userId,
        resolution === 'confirmed' ? 'dispute_resolved_confirmed' : 'dispute_resolved_returned',
        deviceId,
      );
    }
    if (finderDevice?.userId) {
      await this.notify(
        finderDevice.userId,
        resolution === 'confirmed' ? 'dispute_resolved_confirmed' : 'dispute_resolved_returned',
        deviceId,
      );
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
      .select('id, userId, model, serialNumber')
      .eq('id', deviceId)
      .single();

    if (!ownerDevice) {
      throw new NotFoundException('Device not found');
    }

    await this.supabase.from('devices').update({ status, updated_at: now }).eq('id', deviceId);

    const { data: finderDevice } = await this.supabase
      .from('devices')
      .select('id, userId')
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

  // Anything the user needs to actively deal with (failed/disputed/cancelled
  // shipments) is a warning; routine progress updates are just info.
  private static readonly WARNING_MESSAGE_KEYS = new Set([
    'delivery_failed',
    'delivery_disputed',
    'shipment_cancelled',
    'shipment_cancelled_by_owner',
    'package_returned',
    'package_returned_to_you',
  ]);

  private async notify(userId: string, messageKey: string, deviceId: string): Promise<void> {
    const type = CargoService.WARNING_MESSAGE_KEYS.has(messageKey) ? 'warning' : 'info';
    const { error } = await this.supabase.from('notifications').insert({
      user_id: userId,
      message_key: messageKey,
      type,
      is_read: false,
      link: `device/${deviceId}`,
    });

    if (error) {
      this.logger.error(`Failed to create notification (${messageKey}): ${error.message}`, error);
    }
  }
}
