import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StoresController],
  providers: [StoresService, RolesGuard],
})
export class StoresModule {}
