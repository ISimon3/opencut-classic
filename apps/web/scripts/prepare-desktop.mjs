import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

if (process.platform !== "win32" || process.arch !== "x64") {
	throw new Error("This desktop package currently targets Windows x64.");
}
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = join(webDir, "desktop-runtime");
const node =
	process.env.OPENCUT_NODE ||
	(process.versions.bun ? "node" : process.execPath);
const probe = spawnSync(
	node,
	[
		"-p",
		"JSON.stringify({path:process.execPath,version:process.versions.node,arch:process.arch})",
	],
	{ encoding: "utf8" },
);
if (probe.error || probe.status !== 0) {
	throw new Error(
		"Install Node.js 22+ or set OPENCUT_NODE to the full path of node.exe.",
	);
}
const nodeInfo = JSON.parse(probe.stdout.trim());
if (Number(nodeInfo.version.split(".")[0]) < 22 || nodeInfo.arch !== "x64") {
	throw new Error("Windows x64 Node.js 22+ is required.");
}
const env = {
	NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:32123",
	NEXT_PUBLIC_MARBLE_API_URL: "https://api.marblecms.com",
	DATABASE_URL: "postgresql://opencut:opencut@127.0.0.1:5432/opencut",
	BETTER_AUTH_SECRET: "local-desktop-secret-0123456789abcdef",
	UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079",
	UPSTASH_REDIS_REST_TOKEN: "desktop-unconfigured",
	MARBLE_WORKSPACE_KEY: "desktop-unconfigured",
	FREESOUND_CLIENT_ID: "desktop-unconfigured",
	FREESOUND_API_KEY: "desktop-unconfigured",
	...process.env,
	NODE_ENV: "production",
	NEXT_TELEMETRY_DISABLED: "1",
};
const require = createRequire(join(webDir, "package.json"));
const build = spawnSync(
	nodeInfo.path,
	[require.resolve("next/dist/bin/next"), "build"],
	{
		cwd: webDir,
		env,
		stdio: "inherit",
	},
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const standalone = join(webDir, ".next/standalone");
if (!existsSync(join(standalone, "apps/web/server.js"))) {
	throw new Error(
		"Next.js standalone server was not generated at the expected workspace path.",
	);
}
// This is a generated directory under apps/web, never a user-supplied path.
if (relative(webDir, resolve(runtime)) !== "desktop-runtime") {
	throw new Error(
		"Refusing to replace a directory outside apps/web/desktop-runtime.",
	);
}
rmSync(runtime, { recursive: true, force: true });
cpSync(standalone, runtime, { recursive: true, dereference: true });
const serverDir = join(runtime, "apps/web");
mkdirSync(join(serverDir, ".next"), { recursive: true });
cpSync(join(webDir, ".next/static"), join(serverDir, ".next/static"), {
	recursive: true,
});
cpSync(join(webDir, "public"), join(serverDir, "public"), { recursive: true });
cpSync(nodeInfo.path, join(runtime, "node.exe"));
// Include Node's third-party license notices with the redistributed runtime.
const licenseUrl = `https://raw.githubusercontent.com/nodejs/node/v${nodeInfo.version}/LICENSE`;
const licenseResponse = await fetch(licenseUrl);
if (!licenseResponse.ok)
	throw new Error(`Unable to retrieve Node license: ${licenseResponse.status}`);
writeFileSync(join(runtime, "NODE-LICENSE.txt"), await licenseResponse.text());
cpSync(join(webDir, "../../LICENSE"), join(runtime, "OPENCUT-LICENSE.txt"));
console.log(`Prepared desktop runtime using Node ${nodeInfo.version}.`);
