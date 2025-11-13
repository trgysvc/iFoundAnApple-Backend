import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from './auth/guards/admin.guard';
import { RequestUser } from './auth/interfaces/request-user.interface';
import { AppService } from './app.service';

@ApiTags('auth')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Get current user session information' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'User session data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @Get('session')
  getSession(@Req() request: Request): RequestUser {
    return this.appService.extractUserFromRequest(request);
  }

  @ApiTags('admin')
  @ApiOperation({ summary: 'Admin diagnostics endpoint (Admin only)' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Admin diagnostics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin privileges required' })
  @UseGuards(AdminGuard)
  @Get('admin/diagnostics')
  getAdminDiagnostics(): { status: string } {
    return { status: 'admin-ok' };
  }
}


