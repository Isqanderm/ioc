import { NsModule } from "@nexus-ioc/core";
import { FirstModule } from "./first.module";

@NsModule({
	imports: [FirstModule],
})
export class SecondModule {}
