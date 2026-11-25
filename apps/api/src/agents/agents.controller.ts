import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-types.js';
import { countyIdsSchema, type CountyIdsInput } from './agents.schemas.js';
import { AgentsService } from './agents.service.js';

// Every route here is for the manager only. The global guard already
// requires a signed-in user; this adds the role check on the server.
function requireManager(user: AuthUser): void {
  if (user.role !== 'MANAGER') {
    throw new ForbiddenException();
  }
}

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('registrations')
  pending(@CurrentUser() user: AuthUser) {
    requireManager(user);
    return this.agents.listPending();
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    requireManager(user);
    return this.agents.list();
  }

  @Post(':userId/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body({ schema: countyIdsSchema }) body: CountyIdsInput,
  ) {
    requireManager(user);
    return this.agents.approve(userId, body.countyIds);
  }

  @Put(':userId/counties')
  setCounties(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body({ schema: countyIdsSchema }) body: CountyIdsInput,
  ) {
    requireManager(user);
    return this.agents.setCounties(userId, body.countyIds);
  }

  @Post(':userId/enable')
  @HttpCode(200)
  enable(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    requireManager(user);
    return this.agents.enable(userId);
  }

  @Post(':userId/disable')
  @HttpCode(204)
  async disable(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    requireManager(user);
    await this.agents.disable(userId);
  }
}
