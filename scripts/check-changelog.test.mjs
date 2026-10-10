import { describe, expect, it } from "vitest";
import { needsChangeNote } from "./check-changelog.mjs";

describe("PR changelog check", () => {
	it("requires a newly added note for frontend or desktop changes", () => {
		for (const file of ["src/app.tsx", "src-tauri/src/lib.rs"]) {
			expect(needsChangeNote([file], [], [])).toBe(true);
			expect(needsChangeNote([file, "changes/existing.md"], [], [])).toBe(true);
			expect(needsChangeNote([file], ["changes/README.md"], [])).toBe(true);
			expect(needsChangeNote([file], ["changes/new.md"], [])).toBe(false);
		}
	});
	it("allows documentation-only PRs and the explicit label exception", () => {
		expect(needsChangeNote(["README.md", "scripts/check.mjs"], [], [])).toBe(
			false,
		);
		expect(
			needsChangeNote(["src/app.tsx"], [], [{ name: "no-changelog" }]),
		).toBe(false);
		expect(needsChangeNote(["src/app.tsx"], [], [{ name: "bug" }])).toBe(true);
	});
});
