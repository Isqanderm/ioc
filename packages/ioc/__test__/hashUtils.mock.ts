import type { HashUtilInterface } from "../src";
import { HashUtilsServer } from "../src/utils/hash-utils.server";

export const hashUtilsMock: HashUtilInterface = new HashUtilsServer();
