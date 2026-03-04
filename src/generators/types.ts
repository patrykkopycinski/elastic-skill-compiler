import type { GeneratorContext, GeneratorResult } from '../types.js';

export interface PlatformGenerator {
  readonly platform: string;
  generate(ctx: GeneratorContext): Promise<GeneratorResult>;
}
