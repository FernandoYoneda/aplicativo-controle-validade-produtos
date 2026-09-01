import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailGatewayService } from './email-gateway.service';
import { ExpirationNotificationsService } from './expiration-notifications.service';

@Module({
  imports: [PrismaModule],
  providers: [EmailGatewayService, ExpirationNotificationsService],
  exports: [ExpirationNotificationsService],
})
export class NotificationsModule {}
