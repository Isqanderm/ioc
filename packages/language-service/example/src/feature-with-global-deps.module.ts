import { NsModule } from "@nexus-ioc/core";
import { FeatureWithGlobalDepsService } from "./feature-with-global-deps.service";

/**
 * Feature module that uses global dependencies
 *
 * Notice that this module does NOT import GlobalConfigModule or GlobalLoggerModule,
 * but FeatureWithGlobalDepsService can still use GlobalConfigService and GlobalLoggerService
 * because they are provided by global modules.
 *
 * The language service plugin will NOT show errors for these dependencies.
 */
@NsModule({
	providers: [FeatureWithGlobalDepsService],
	exports: [FeatureWithGlobalDepsService],
})
export class FeatureWithGlobalDepsModule {}

