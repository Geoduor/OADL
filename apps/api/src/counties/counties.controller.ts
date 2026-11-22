import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { CountiesService } from './counties.service.js';

@Public()
@Controller('counties')
export class CountiesController {
  constructor(private readonly counties: CountiesService) {}

  @Get()
  list() {
    return this.counties.list();
  }
}
