import { Module } from "nexus-ioc";
import { HttpModule } from "../http/http.module";
import { RpcModule } from "../rpc/rpc.module";

@Module({
	imports: [RpcModule, HttpModule],
})
export class PostsModule {}
