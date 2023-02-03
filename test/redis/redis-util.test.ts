import { getRedisConnectionDetails } from "../../lib/redis/redis-util";

describe("redis-util", () => {
  describe("getRedisConnectionDetails", () => {
    [
      {
        title: "from host and defaults",
        input: {
          host: "redis.jfugq7.ng.0001.euw1.cache.amazonaws.com",
        },
        expected: {
          host: "redis.jfugq7.ng.0001.euw1.cache.amazonaws.com",
          port: "6379",
          database: "0",
        },
      },
      {
        title: "as provided",
        input: {
          host: "redis.jfugq7.ng.0001.euw1.cache.amazonaws.com",
          port: "1234",
          database: "4",
        },
        expected: {
          host: "redis.jfugq7.ng.0001.euw1.cache.amazonaws.com",
          port: "1234",
          database: "4",
        },
      },
      {
        title: "from DSN",
        input: {
          host: "redis://localhost:6379",
        },
        expected: {
          host: "localhost",
          port: "6379",
          database: "0",
        },
      },
      {
        title: "from DSN with database number",
        input: {
          host: "redis://redis-test:6379/3",
        },
        expected: {
          host: "redis-test",
          port: "6379",
          database: "3",
        },
      },
      {
        title: "from host:port",
        input: {
          host: "redis-test:6789",
        },
        expected: {
          host: "redis-test",
          port: "6789",
          database: "0",
        },
      },
      {
        title: "from host:port with database number",
        input: {
          host: "redis-test:6379",
          database: "5",
        },
        expected: {
          host: "redis-test",
          port: "6379",
          database: "5",
        },
      },
    ].forEach(({ title, input, expected }) => {
      test(`Gets Redis connection details ${title}`, () => {
        expect(getRedisConnectionDetails(input)).toEqual(expected);
      });
    });
  });
});
