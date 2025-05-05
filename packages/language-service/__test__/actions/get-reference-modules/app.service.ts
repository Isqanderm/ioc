import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class AppService {
    public getData(): string {
        return "data";
    }
}
