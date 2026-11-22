import { Controller, Get } from '@nestjs/common';
import { CountiesService } from './counties.service.js';

@Controller('counties')
export class CountiesController {
  constructor(private readonly counties: CountiesService) {}

  @Get()
  list() {
    return this.counties.list();
  }
}
