import { NsModule } from "nexus-ioc";
import { UserService } from "./user.service";
import {HttpModule} from "../http/http.module";

@NsModule({
  imports: [HttpModule],
  providers: [UserService],
})
export class UserModule {}
