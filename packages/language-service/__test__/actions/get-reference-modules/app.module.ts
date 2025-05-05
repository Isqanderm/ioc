import { NsModule } from "@nexus-ioc/core";
import { AppService } from "./app.service";

@NsModule({
    providers: [AppService],
    exports: [AppService]
})
export class AppModule {}
