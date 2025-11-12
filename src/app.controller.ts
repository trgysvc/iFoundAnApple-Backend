import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from './auth/guards/admin.guard';
import { RequestUser } from './auth/interfaces/request-user.interface';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('session')
  getSession(@Req() request: Request): RequestUser {
    return this.appService.extractUserFromRequest(request);
  }

  @UseGuards(AdminGuard)
  @Get('admin/diagnostics')
  getAdminDiagnostics(): { status: string } {
    return { status: 'admin-ok' };
  }
}


