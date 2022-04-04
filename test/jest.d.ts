declare namespace jest {
  interface Matchers<R> {
    toHaveAllProperties(props: any, omit: string[] = []): CustomMatcherResult;
  }
}
