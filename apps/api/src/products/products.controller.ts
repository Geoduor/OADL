import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ProductsService } from './products.service.js';

@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.listActive();
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const product = await this.products.findActiveBySlug(slug);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }
}
