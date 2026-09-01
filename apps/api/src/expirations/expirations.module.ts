import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExpirationsController } from './expirations.controller';
import { ExpirationsService } from './expirations.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [ExpirationsController],
  providers: [ExpirationsService, RolesGuard],
})
export class ExpirationsModule {}
