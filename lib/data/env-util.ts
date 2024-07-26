const NEWLINE = "\n";
const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*("[^"]*"|'[^']*'|.*?)(\s+#.*)?$/;
const RE_NEWLINES = /\\n/g;
const NEWLINES_MATCH = /\r\n|\n|\r/;

/**
 * Parse .env file's contents into an object.
 * @param env Contents to be parsed.
 * @returns A key-value object with parsed values.
 */
export function parseEnv(env: string | Buffer): Record<string, string> {
  const result: Record<string, string> = {};

  // convert Buffers before splitting into lines and processing
  const lines = env.toString().split(NEWLINES_MATCH);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // matching "KEY' and 'VAL' in 'KEY=VAL'
    const keyValueArr = line.match(RE_INI_KEY_VAL);
    // matched?
    if (keyValueArr != null) {
      const key = keyValueArr[1];
      // default undefined or missing values to empty string
      let val = keyValueArr[2] || "";
      const end = val.length - 1;
      const isDoubleQuoted = val[0] === '"' && val[end] === '"';
      const isSingleQuoted = val[0] === "'" && val[end] === "'";

      // if parsing line breaks and the value starts with a quote
      if (isSingleQuoted || isDoubleQuoted) {
        val = val.substring(1, end);

        // if double quoted, expand newlines
        if (isDoubleQuoted) {
          val = val.replace(RE_NEWLINES, NEWLINE);
        }
      } else {
        // remove surrounding whitespace
        val = val.trim();
      }

      result[key] = val;
    } else {
      const trimmedLine = line.trim();

      // ignore empty and commented lines
      if (trimmedLine.length && trimmedLine[0] !== "#") {
        throw new Error(
          `Failed to match key and value when parsing line ${idx + 1}: ${line}`,
        );
      }
    }
  }

  return result;
}
