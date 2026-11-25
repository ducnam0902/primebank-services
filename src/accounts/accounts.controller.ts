import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccountResponseDto } from './dto/account-response.dto';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { ApiSuccessResponse } from '@/common/decorators/api-success-response.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma/enums';
import { AccountLookupResponseDto } from './dto/account-lookup-response.dto';
import { LookupAccountParamsDto } from './dto/lookup-account-params.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get customer accounts' })
  @ApiSuccessResponse(AccountResponseDto, true)
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  getAllCustomerAccounts(
    @CurrentUser('id') id: string,
  ): Promise<AccountResponseDto[]> {
    return this.accountsService.getAllCustomerAccounts(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer account by ID' })
  @ApiSuccessResponse(AccountResponseDto)
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  getCustomerAccountById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.getCustomerAccountById(id, userId);
  }

  @Get('lookup/:accountNumber')
  @ApiOperation({ summary: 'Lookup account by number' })
  @ApiSuccessResponse(AccountLookupResponseDto)
  @ApiBearerAuth('access-token')
  @Roles(Role.CUSTOMER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookupAccount(
    @Param() { accountNumber }: LookupAccountParamsDto,
  ): Promise<AccountLookupResponseDto> {
    return this.accountsService.lookupAccount(accountNumber);
  }
}
