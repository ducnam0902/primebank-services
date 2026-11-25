import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { isValidAccountNumber } from '../utils/account-number.util';

export function IsAccountNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAccountNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          return isValidAccountNumber(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid account number`;
        },
      },
    });
  };
}
