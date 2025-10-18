import { NsModule } from "nexus-ioc";
import { HttpModule } from "../http/http.module";
import { RpcModule } from "../rpc/rpc.module";

@NsModule({
	imports: [RpcModule, HttpModule],
})
export class PostsModule {}
