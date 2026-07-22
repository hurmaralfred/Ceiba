import {
  readdir,
  readFile,
} from "node:fs/promises";

import path from "node:path";

const root = process.cwd();

const activeRoots = ["src"];

const forbiddenPatterns = [
  /\bparent_of\b/g,
  /\bpartner_of\b/g,
  /\bsibling_of\b/g,
  /\bhalf_sibling_of\b/g,
  /\bguardian_of\b/g,
  /\badoptive_parent_of\b/g,
  /\bget_family_tree\b/g,
  /\bfind_name_matches\b/g,
  /\bconfirm_name_match\b/g,
  /\blink_persons\b/g,
];

const forbiddenNames = [
  /\.bak2?$/,
  /\.before-/,
  /^\.DS_Store$/,
];

async function walk(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];

for (const relativeRoot of activeRoots) {
  const directory = path.join(
    root,
    relativeRoot
  );

  const files = await walk(directory);

  for (const file of files) {
    const relative = path.relative(root, file);

    if (
      relative === "src/types/database.types.ts"
    ) {
      continue;
    }

    if (
      forbiddenNames.some((pattern) =>
        pattern.test(path.basename(file))
      )
    ) {
      violations.push(
        `${relative}: archivo de respaldo o basura no permitido`
      );
      continue;
    }

    if (!/\.(ts|tsx|js|jsx|sql|md)$/.test(file)) {
      continue;
    }

    const content = await readFile(
      file,
      "utf8"
    );

    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of forbiddenPatterns) {
        pattern.lastIndex = 0;

        if (pattern.test(line)) {
          violations.push(
            `${relative}:${index + 1}: ${line.trim()}`
          );
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    "Se encontraron contratos heredados activos:\n"
  );

  console.error(violations.join("\n"));
  process.exit(1);
}

console.log(
  "Auditoría contractual superada: no hay contratos heredados activos en src."
);
