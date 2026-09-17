import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSelected } from './users.select';
import { PaginatedResult } from '@/common/interfaces/paginated-result.interface';
import { ApiSuccessResponse } from '@/common/decorators/api-success-response.decorator';
import { Public } from '@/auth/decorators/public.decorator';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Danh sách người dùng (phân trang)' })
  @ApiSuccessResponse(UserResponseDto)
  @Get()
  @Public()
  findAll(
    @Query() query: FindUsersQueryDto,
  ): Promise<PaginatedResult<UserSelected>> {
    return this.usersService.findAll(query);
  }

  @ApiOperation({ summary: 'Chi tiết người dùng' })
  @ApiSuccessResponse(UserResponseDto)
  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserSelected> {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Cập nhật người dùng' })
  @ApiSuccessResponse(UserResponseDto)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSelected> {
    return this.usersService.update(id, dto);
  }
}
