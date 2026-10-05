import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @ApiOperation({ summary: 'Kiểm tra server', description: 'Dùng cho health check của Docker/load balancer.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T08:30:00.000Z' },
      },
    },
  })
  @Get(['', 'health'])
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
