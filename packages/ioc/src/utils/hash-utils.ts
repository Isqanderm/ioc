import type { HashUtilInterface } from "../interfaces";

export class HashUtil implements HashUtilInterface {
  private increment = 0;

  async hashString(value: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  async hashObject(value: object): Promise<string> {
    const json = JSON.stringify(value);
    return this.hashString(json);
  }

  incrementString(): string {
    return `${this.increment++}`;
  }
}
