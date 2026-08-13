import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { CargoService } from './cargo.service';
import { CancelByOwnerDto } from './dto/cancel-by-owner.dto';
import { DisputeReceiptDto } from './dto/dispute-receipt.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { SubmitCargoTrackingDto } from './dto/submit-cargo-tracking.dto';
import { UpdateCargoStatusDto } from './dto/update-cargo-status.dto';

@ApiTags('cargo')
@Controller('cargo')
@ApiBearerAuth('bearer')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @ApiOperation({
    summary: 'List cargo shipments (Admin only)',
    description:
      'No real carrier is integrated. This lists every shipment record so ops can see which ones still need a real tracking number entered.',
  })
  @ApiResponse({ status: 200, description: 'Shipments retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin privileges required' })
  @UseGuards(AdminGuard)
  @Get('shipments')
  async listShipments(): Promise<any[]> {
    return this.cargoService.listShipments();
  }

  @ApiOperation({
    summary: 'Submit real cargo tracking info for a shipment (Admin only)',
    description:
      'Ops books the shipment with a real carrier outside this system and enters the resulting tracking number here. Moves both the owner and finder device rows to cargo_shipped and notifies both users.',
  })
  @ApiResponse({ status: 200, description: 'Tracking info saved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin privileges required' })
  @ApiResponse({ status: 404, description: 'No cargo shipment found for this device' })
  @UseGuards(AdminGuard)
  @Patch('shipments/:deviceId/tracking')
  async submitTracking(
    @Param('deviceId') deviceId: string,
    @Body() dto: SubmitCargoTrackingDto,
  ): Promise<{ success: boolean }> {
    return this.cargoService.submitTracking(deviceId, dto);
  }

  @ApiOperation({
    summary: 'Advance a shipment to the next carrier-reported status (Admin only)',
    description:
      'No carrier API is integrated: ops enters the status the carrier reported by phone/tracking page. Carrier name / tracking number are optional and can be attached at any step. Does not affect escrow — only the owner\'s own confirmation via the /received endpoint does that.',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin privileges required' })
  @ApiResponse({ status: 404, description: 'No cargo shipment found for this device' })
  @UseGuards(AdminGuard)
  @Patch('shipments/:deviceId/status')
  async updateStatus(
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateCargoStatusDto,
  ): Promise<{ success: boolean }> {
    return this.cargoService.updateStatus(deviceId, dto);
  }

  @ApiOperation({
    summary: 'Get payment/escrow/cargo summary for a device (owner or finder)',
    description:
      "payments.device_id always references the owner's device row, so the finder's own client can never read it directly (RLS). This resolves the owner/finder pair server-side with the service-role client and returns the summary either side is allowed to see.",
  })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the device owner' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @Get('shipments/:deviceId/summary')
  async getShipmentSummary(
    @Param('deviceId') deviceId: string,
    @Req() request: Request,
  ): Promise<{ payment: any; escrow: any; cargoShipment: any }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.cargoService.getShipmentSummary(deviceId, user.id);
  }

  @ApiOperation({
    summary: 'Owner confirms the physical package arrived',
    description:
      'Self-reported by the device owner. There is no carrier webhook to detect delivery automatically.',
  })
  @ApiResponse({ status: 200, description: 'Marked as received successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only the device owner can confirm receipt' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @Patch('shipments/:deviceId/received')
  async markReceived(
    @Param('deviceId') deviceId: string,
    @Req() request: Request,
  ): Promise<{ success: boolean }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.cargoService.markReceived(deviceId, user.id);
  }

  @ApiOperation({
    summary: 'Owner cancels the transaction before the device has shipped',
    description:
      'Only valid while cargo is still created/pending (not picked_up or later). Immediately refunds the held escrow to the owner via Paynet.',
  })
  @ApiResponse({ status: 200, description: 'Cancelled and refunded successfully' })
  @ApiResponse({ status: 400, description: 'Cargo has already shipped, cannot self-cancel' })
  @ApiResponse({ status: 403, description: 'Forbidden - only the device owner can cancel' })
  @ApiResponse({ status: 404, description: 'Device or payment not found' })
  @Patch('shipments/:deviceId/cancel')
  async cancelByOwner(
    @Param('deviceId') deviceId: string,
    @Body() dto: CancelByOwnerDto,
    @Req() request: Request,
  ): Promise<{ success: boolean }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.cargoService.cancelByOwner(deviceId, user.id, dto.reason || 'Owner cancelled before shipment');
  }

  @ApiOperation({
    summary: 'Owner disputes a carrier-reported delivery',
    description:
      'Alternative to /received when the owner has a problem with what arrived (wrong/damaged/missing device). Blocks escrow release until ops resolves the dispute.',
  })
  @ApiResponse({ status: 200, description: 'Dispute recorded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only the device owner can dispute receipt' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @Patch('shipments/:deviceId/dispute')
  async disputeReceipt(
    @Param('deviceId') deviceId: string,
    @Body() dto: DisputeReceiptDto,
    @Req() request: Request,
  ): Promise<{ success: boolean }> {
    const user = request.user as RequestUser;
    if (!user) {
      throw new Error('User not found in request');
    }

    return this.cargoService.disputeReceipt(deviceId, user.id, dto.reason);
  }

  @ApiOperation({
    summary: 'Manually release escrow for a confirmed device (Admin only)',
    description:
      "For devices stuck at 'confirmed' because the automatic release (triggered by markReceived/resolveDispute) failed or hasn't run yet.",
  })
  @ApiResponse({ status: 200, description: 'Escrow released successfully' })
  @ApiResponse({ status: 400, description: 'Device is not in a confirmed state' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Device or payment not found' })
  @UseGuards(AdminGuard)
  @Patch('shipments/:deviceId/admin-release-escrow')
  async adminReleaseEscrow(@Param('deviceId') deviceId: string): Promise<{ success: boolean }> {
    return this.cargoService.adminReleaseEscrow(deviceId);
  }

  @ApiOperation({
    summary: 'Resolve a disputed delivery (Admin only)',
    description:
      'Ops investigates outside the system (phone, photos) and resolves the dispute — either confirming receipt as normal or sending the device back to the finder.',
  })
  @ApiResponse({ status: 200, description: 'Dispute resolved successfully' })
  @ApiResponse({ status: 400, description: 'Device is not currently disputed' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  @UseGuards(AdminGuard)
  @Patch('shipments/:deviceId/resolve-dispute')
  async resolveDispute(
    @Param('deviceId') deviceId: string,
    @Body() dto: ResolveDisputeDto,
  ): Promise<{ success: boolean }> {
    return this.cargoService.resolveDispute(deviceId, dto.resolution);
  }
}
