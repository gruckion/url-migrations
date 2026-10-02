export { checkMigrations, type CheckInput, type CheckResult, type Fixture, type Problem, type Waiver } from './check';
export { diffContracts } from './diff';
export { extractContract, type ExtractOptions } from './extract';
export { describeShape, mergeShapes, sameShape } from './shape';
export { validateURL, type ParamIssue, type Validation } from './validate';
export type {
  Change,
  Contract,
  ExtractResult,
  ExtractWarning,
  ParamOrigin,
  ParamShape,
  RouteContract,
  Severity,
} from './types';
