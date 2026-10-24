import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '../users/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Controller('audit')
export class AuditController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('summary')
  getSummary(@GetUser() user: User) {
    return {
      status: 'success',
      message: 'Métricas de auditoría y cumplimiento recuperadas satisfactoriamente',
      data: {
        adminUser: {
          id: user.id,
          email: user.email,
          roles: user.roles,
        },
        systemStatus: 'COMPLIANT_ACTIVE',
        totalAuditedEvents: 1420,
        riskScore: 'LOW',
        complianceHealthPercent: 99.8,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
