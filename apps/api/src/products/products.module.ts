import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductImportService } from './product-import.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductImportService, RolesGuard],
})
export class ProductsModule {}
