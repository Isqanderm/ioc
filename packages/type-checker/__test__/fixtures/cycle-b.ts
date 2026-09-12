import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { CycleA } from "./cycle-a";

@Service()
export class CycleB {
  constructor(@Dependency(CycleA) cycleA: CycleA) {}
}
