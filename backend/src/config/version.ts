import fs from "fs";
import path from "path";

const readVersionFromPackageJson = () => {
  const candidates = [
    path.resolve(process.cwd(), "package.json"),
    path.resolve(__dirname, "../../package.json"),
    path.resolve(__dirname, "../../../package.json"),
  ];

  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as { version?: string };
      if (parsed.version) {
        return parsed.version;
      }
    } catch {
      // Continue trying the next candidate path.
    }
  }

  return "0.0.0";
};

export const appVersion = process.env.APP_VERSION?.trim() || readVersionFromPackageJson();
