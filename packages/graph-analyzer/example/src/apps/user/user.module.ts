import { Module } from "nexus-ioc";
import { HttpModule } from "../http/http.module";
import { UserService } from "./user.service";

@Module({
	imports: [HttpModule],
	providers: [UserService],
})
export class UserModule {}
