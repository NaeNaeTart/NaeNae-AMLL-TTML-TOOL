import { describe, expect, it } from "vitest";
import {
	addChecklistEntry,
	deleteChecklistEntry,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	updateChecklistEntry,
} from "./logic";

describe("TTML checklist", () => {
	it("adds newest active entries first", () => {
		const first = addChecklistEntry(
			[],
			{ song: "First", artist: "", notes: "" },
			1,
			"one",
		);
		const entries = addChecklistEntry(
			first,
			{ song: "Second", artist: "Artist", notes: "Idea" },
			2,
			"two",
		);
		expect(entries.map((entry) => entry.id)).toEqual(["two", "one"]);
	});

	it("edits, completes, and deletes entries", () => {
		const initial = addChecklistEntry(
			[],
			{ song: "Song", artist: "", notes: "" },
			1,
			"one",
		);
		const edited = updateChecklistEntry(initial, "one", {
			song: " Song 2 ",
			artist: "Artist",
			notes: "Note",
		});
		expect(edited[0]).toMatchObject({
			song: "Song 2",
			artist: "Artist",
			notes: "Note",
		});
		const completed = setChecklistEntryCompleted(edited, "one", true);
		expect(completed[0]?.completed).toBe(true);
		expect(deleteChecklistEntry(completed, "one")).toEqual([]);
	});

	it("normalizes persisted data and ignores malformed entries", () => {
		const entries = normalizeChecklistEntries([
			{ id: "valid", song: "  Song ", artist: 3, notes: null, completed: true },
			{ song: "Legacy" },
			{ id: "bad", song: "" },
			null,
		]);
		expect(entries).toEqual([
			{
				id: "legacy-1",
				song: "Legacy",
				artist: "",
				notes: "",
				completed: false,
				createdAt: 0,
			},
			{
				id: "valid",
				song: "Song",
				artist: "",
				notes: "",
				completed: true,
				createdAt: 0,
			},
		]);
	});
});
