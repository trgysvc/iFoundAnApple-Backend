import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { CargoService } from './cargo.service';
import { SubmitCargoTrackingDto } from './dto/submit-cargo-tracking.dto';

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
}
