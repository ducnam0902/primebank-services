import { IsAccountNumber } from '../decorators/is-account-number.decorator';

export class LookupAccountParamsDto {
  @IsAccountNumber()
  accountNumber!: string;
}
