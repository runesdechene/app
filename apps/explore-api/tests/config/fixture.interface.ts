import { ITester } from './tester.interface.js';

export interface IFixture {
  load(tester: ITester): Promise<void>;
}
