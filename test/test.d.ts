interface CustomMatchers<R = unknown> {
  toHaveAllProperties(props: object, omit: string[] = []): R;
}

declare global {
  namespace Vi {
    interface Assertion extends CustomMatchers {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
  }
}

export {};
