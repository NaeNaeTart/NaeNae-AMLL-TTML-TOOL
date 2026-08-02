import assert from "node:assert/strict";
import test from "node:test";
import {
	assertMatchingVersions,
	bumpVersion,
	readVersions,
	updateVersionSources,
} from "./version-utils.mjs";

const sources = {
	"package.json": '{\n\t"version": "0.7.7"\n}\n',
	"src-tauri/tauri.conf.json": '{\n\t"version": "0.7.7"\n}\n',
	"src-tauri/Cargo.toml":
		'[package]\nname = "amll-ttml-tool"\nversion = "0.7.7"\n\n[dependencies]\n',
	"src-tauri/Cargo.lock":
		'[[package]]\nname = "amll-ttml-tool"\nversion = "0.7.7"\ndependencies = []\n',
};

test("calculates stable SemVer bumps", () => {
	assert.equal(bumpVersion("0.7.7", "patch"), "0.7.8");
	assert.equal(bumpVersion("0.7.7", "minor"), "0.8.0");
	assert.equal(bumpVersion("0.7.7", "major"), "1.0.0");
});

test("rejects unsupported bump types and prerelease versions", () => {
	assert.throws(() => bumpVersion("0.7.7", "tiny"), /patch, minor, or major/);
	assert.throws(() => bumpVersion("0.7.7-alpha.1", "patch"), /stable SemVer/);
});

test("reads, checks, and updates every version source", () => {
	assert.equal(assertMatchingVersions(readVersions(sources)), "0.7.7");
	const updated = updateVersionSources(sources, "0.7.7", "0.8.0");
	assert.deepEqual(
		new Set(Object.values(readVersions(updated))),
		new Set(["0.8.0"]),
	);
});

test("rejects mismatched source versions", () => {
	const mismatched = {
		...sources,
		"src-tauri/tauri.conf.json": '{"version":"0.7.6"}',
	};
	assert.throws(
		() => assertMatchingVersions(readVersions(mismatched)),
		/Version files do not match/,
	);
});
