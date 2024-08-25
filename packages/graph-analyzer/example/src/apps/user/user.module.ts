import { NsModule } from "nexus-ioc";
import { HttpModule } from "../http/http.module";
import { UserService } from "./user.service";

@NsModule({
	imports: [HttpModule],
	providers: [UserService],
})
export class UserModule {}
