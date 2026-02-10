import { Controller, Get } from '@nestjs/common';
import { PublicRoute } from '../guards/public-route.js';

@PublicRoute()
@Controller()
export class AppController {
  constructor() {}

  @Get()
  get() {
    return {
      name: 'Guilde des Voyageurs',
    };
  }
}
