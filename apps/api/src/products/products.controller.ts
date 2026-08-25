import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Product } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { ProductPage } from './product-page.types';
import { ProductImportService } from './product-import.service';
import type {
  ProductImportPreview,
  ProductImportResult,
  UploadedProductSpreadsheet,
} from './product-import.types';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productImportService: ProductImportService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STORE_USER)
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get('page')
  @Roles(UserRole.ADMIN)
  findPage(@Query() query: ListProductsQueryDto): Promise<ProductPage> {
    return this.productsService.findPage(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productsService.create(createProductDto);
  }

  @Post('import/preview')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 15 * 1024 * 1024,
      },
    }),
  )
  previewImport(
    @UploadedFile() file?: UploadedProductSpreadsheet,
  ): Promise<ProductImportPreview> {
    return this.productImportService.preview(file);
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 15 * 1024 * 1024,
      },
    }),
  )
  importProducts(
    @UploadedFile() file?: UploadedProductSpreadsheet,
  ): Promise<ProductImportResult> {
    return this.productImportService.import(file);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(id, updateProductDto);
  }
}
