expect.extend({
  toHaveAllProperties(received, props: object, omit: string[] = []) {
    let pass = true;
    const missing = [];

    const receivedStr = JSON.stringify(received);
    for (const key of Object.keys(props)) {
      if (omit.includes(key)) {
        continue;
      }

      if (!receivedStr.includes(`"${key}":`)) {
        pass = false;
        missing.push(key);
      }
    }

    const objectStr =
      typeof received?.kind === "string" ? received.kind : "Object";
    const propertyStr =
      missing.length > 1
        ? `properties '${missing.join("', '")}'`
        : `property '${missing[0]}'`;

    if (pass) {
      return {
        message: () => `expected ${objectStr} not to have ${propertyStr}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${objectStr} to have ${propertyStr}`,
        pass: false,
      };
    }
  },
});
