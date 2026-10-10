import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateContributors } from "./generate-contributors.mjs";

const author = (id, login) => ({
	id,
	login,
	avatar_url: `https://avatars.example/${login}`,
	html_url: `https://github.com/${login}`,
});

test("counts commits per author, most first, ties by name", () => {
	const result = aggregateContributors([
		{ author: author(2, "zed") },
		{ author: author(1, "amy") },
		{ author: author(2, "zed") },
		{ author: author(3, "bob") },
	]);
	assert.deepEqual(
		result.map((c) => [c.login, c.contributions]),
		[
			["zed", 2],
			["amy", 1],
			["bob", 1],
		],
	);
	assert.equal(result[0].profileUrl, "https://github.com/zed");
});

test("skips unlinked commits, excluded upstream authors and placeholder accounts", () => {
	const result = aggregateContributors([
		{ author: null },
		{ author: author(39_523_898, "upstream") },
		{ author: author(9, "invalid-email-address") },
		{ author: author(4, "kept") },
	]);
	assert.deepEqual(
		result.map((c) => c.login),
		["kept"],
	);
});
