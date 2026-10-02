import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsMinAge(minAge = 18, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMinAge',
      target: object.constructor,
      propertyName,
      constraints: [minAge],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [min] = args.constraints as [number];
          const dob =
            value instanceof Date
              ? value
              : typeof value === 'string'
                ? new Date(value)
                : null;
          if (!dob || Number.isNaN(dob.getTime())) return false;

          const now = new Date();
          let age = now.getUTCFullYear() - dob.getUTCFullYear();
          const m = now.getUTCMonth() - dob.getUTCMonth();
          if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;

          return age >= min;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be at least ${args.constraints[0]} years old`;
        },
      },
    });
  };
}
