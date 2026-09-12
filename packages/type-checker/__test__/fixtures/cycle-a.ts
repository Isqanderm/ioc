import { Inject as Dependency, Injectable as Service } from "@nexus-ioc/core";
import { CycleB } from "./cycle-b";

@Service()
export class CycleA {
  constructor(@Dependency(CycleB) cycleB: CycleB) {}
}
