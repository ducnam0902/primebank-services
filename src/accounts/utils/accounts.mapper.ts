import { AccountSelected } from '../accounts.select';
import { AccountResponseDto } from '../dto/account-response.dto';

export function toAccountResponse(
  account: AccountSelected,
): AccountResponseDto {
  return {
    id: account.id,
    accountNumber: account.accountNumber,
    type: account.type,
    currency: account.currency,
    status: account.status,
    balance: account.balance.toFixed(2),
    createdAt: account.createdAt,
  };
}
