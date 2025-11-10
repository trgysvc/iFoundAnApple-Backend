import { Injectable } from '@nestjs/common';
import { HealthResponse } from './health.types';

@Injectable()
export class HealthService {
  getHealthStatus(): HealthResponse {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

