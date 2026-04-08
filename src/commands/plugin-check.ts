import { join } from "node:path";
import {
  discoverAllPlugins,
  findOrphansAndPhantoms,
  loadMarketplace,
} from "../lib/build-utils";

export function runPluginCheck(root: string): void {
  const marketplace = loadMarketplace(root);
  if (!marketplace) {
    process.stderr.write("No .claude-plugin/marketplace.json found.\n");
    process.stderr.write("Run 'tagen build --all' to generate it.\n");
    process.exit(1);
  }

  const { orphans, phantoms } = findOrphansAndPhantoms(root);
  let issues = 0;

  if (orphans.length > 0) {
    process.stdout.write(`\nOrphan plugins (on disk but not in marketplace.json):\n`);
    for (const name of orphans) {
      process.stdout.write(`  plugins/${name}/\n`);
    }
    issues += orphans.length;
  }

  if (phantoms.length > 0) {
    process.stdout.write(`\nPhantom entries (in marketplace.json but no directory):\n`);
    for (const name of phantoms) {
      process.stdout.write(`  ${name} → directory not found\n`);
    }
    issues += phantoms.length;
  }

  const pluginsDir = join(root, "plugins");
  const onDisk = discoverAllPlugins(pluginsDir);

  if (issues === 0) {
    process.stdout.write(
      `All ${onDisk.length} plugin(s) registered. No orphans or phantoms.\n`
    );
  } else {
    process.stdout.write(`\n${issues} issue(s) found.\n`);
    process.exit(1);
  }
}
