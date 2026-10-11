/**
 * The ORDS handler builds JSON by hand with HTP.P, so the output can be
 * slightly malformed. This repairs the common problems:
 *  - numbers without a leading zero (".5" -> "0.5", "-.5" -> "-0.5")
 *  - raw control characters (newline/tab) inside strings
 *  - invalid backslash escapes inside strings
 *  - trailing commas before } or ]
 */
export function repairJson(input: string): string {
  const out: string[] = [];
  let inString = false;
  // Index in `out` of the last non-whitespace character written.
  let lastSig = -1;

  const push = (s: string) => {
    out.push(s);
    if (s.trim() !== "") lastSig = out.length - 1;
  };
  const prevSig = () => (lastSig >= 0 ? out[lastSig] : "");
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (ch === "\\") {
        const next = i + 1 < input.length ? input[i + 1] : "";
        if (next !== "" && '"\\/bfnrtu'.includes(next)) {
          push(ch);
          push(next);
          i++;
        } else {
          push("\\\\"); // lone backslash -> escaped backslash
        }
      } else if (ch === '"') {
        inString = false;
        push(ch);
      } else if (ch === "\n") {
        push("\\n");
      } else if (ch === "\r") {
        push("\\r");
      } else if (ch === "\t") {
        push("\\t");
      } else if (ch.charCodeAt(0) < 0x20) {
        push(" ");
      } else {
        push(ch);
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      push(ch);
      continue;
    }

    if (ch === "." && isDigit(input[i + 1]) && !isDigit(prevSig())) {
      push("0");
      push(ch);
      continue;
    }

    if ((ch === "}" || ch === "]") && prevSig() === ",") {
      out[lastSig] = ""; // drop trailing comma
    }

    push(ch);
  }

  return out.join("");
}

/** Strict parse first; on failure, repair and parse again. */
export function parseJsonLenient(text: string): unknown {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return JSON.parse(clean);
  } catch {
    return JSON.parse(repairJson(clean));
  }
}
