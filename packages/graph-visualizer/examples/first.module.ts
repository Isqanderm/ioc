import { NsModule } from "@nexus-ioc/core";
import { SecondModule } from "./second.module";

@NsModule({
	imports: [SecondModule],
})
export class FirstModule {}
