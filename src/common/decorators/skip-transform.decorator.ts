import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

export const SkipTransform: () => ParameterDecorator = () =>
  SetMetadata(SKIP_TRANSFORM_KEY, true);
