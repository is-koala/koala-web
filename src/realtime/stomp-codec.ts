export type StompFrame = {
  command: string;
  headers: Map<string, string>;
  body: string;
};

export function stompFrame(
  command: string,
  headers: readonly (readonly [string, string])[] = [],
) {
  const lines = [command, ...headers.map(([name, value]) => `${name}:${escapeHeader(value)}`)];
  return `${lines.join("\n")}\n\n\0`;
}

export function framesOf(payload: string): StompFrame[] {
  return payload
    .replaceAll("\r\n", "\n")
    .split("\0")
    .map((value) => value.replace(/^\n+/, ""))
    .filter((value) => value.length > 0)
    .map(parseFrame)
    .filter((frame): frame is StompFrame => frame !== null);
}

function escapeHeader(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n").replaceAll(":", "\\c");
}

function parseFrame(raw: string): StompFrame | null {
  const separator = raw.indexOf("\n\n");
  const head = separator >= 0 ? raw.slice(0, separator) : raw;
  const body = separator >= 0 ? raw.slice(separator + 2) : "";
  const [command, ...headerLines] = head.split("\n");
  if (!command) return null;

  const headers = new Map<string, string>();
  headerLines.forEach((line) => {
    const colon = line.indexOf(":");
    if (colon <= 0) return;
    headers.set(line.slice(0, colon), unescapeHeader(line.slice(colon + 1)));
  });
  return { command, headers, body };
}

function unescapeHeader(value: string) {
  return value.replace(/\\([crn\\])/g, (_, escaped: string) => {
    if (escaped === "c") return ":";
    if (escaped === "r") return "\r";
    if (escaped === "n") return "\n";
    return "\\";
  });
}
