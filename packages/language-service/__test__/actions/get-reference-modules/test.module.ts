import { NsModule } from "@nexus-ioc/core";
import { AppService } from "./app.service";

@NsModule({
    providers: [AppService],
    exports: []
})
export class TestModule {}
