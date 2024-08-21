import { NsModule } from "nexus-ioc";
import { RpcModule } from "../rpc/rpc.module";

@NsModule({
	imports: [RpcModule],
})
export class PostsModule {}
