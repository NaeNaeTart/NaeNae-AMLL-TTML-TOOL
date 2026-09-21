import { describe, expect, it, vi } from "vitest";
import { LRUCache } from "./lru-cache";

describe("LRUCache", () => {
	it("inserts and retrieves items via set and get", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);

		expect(cache.get("a")).toBe(1);
		expect(cache.get("b")).toBe(2);
		expect(cache.get("non-existent")).toBeUndefined();
	});

	it("updates usage order when get is invoked", () => {
		const cache = new LRUCache<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);

		// Access "a" so that "b" becomes the least recently used
		expect(cache.get("a")).toBe(1);

		// Adding "c" should evict "b"
		cache.set("c", 3);

		expect(cache.get("a")).toBe(1);
		expect(cache.get("c")).toBe(3);
		expect(cache.get("b")).toBeUndefined();
	});

	it("evicts the least recently used item when exceeding maxSize", () => {
		const cache = new LRUCache<string, string>(2);
		cache.set("k1", "v1");
		cache.set("k2", "v2");
		cache.set("k3", "v3");

		expect(cache.get("k1")).toBeUndefined();
		expect(cache.get("k2")).toBe("v2");
		expect(cache.get("k3")).toBe("v3");
	});

	it("calls onEvict when evicting due to capacity overflow", () => {
		const onEvict = vi.fn();
		const cache = new LRUCache<string, number>(2, onEvict);

		cache.set("a", 100);
		cache.set("b", 200);
		expect(onEvict).not.toHaveBeenCalled();

		cache.set("c", 300);
		expect(onEvict).toHaveBeenCalledTimes(1);
		expect(onEvict).toHaveBeenCalledWith("a", 100);
	});

	it("calls onEvict when replacing an existing key", () => {
		const onEvict = vi.fn();
		const cache = new LRUCache<string, number>(2, onEvict);

		cache.set("a", 10);
		cache.set("a", 20);

		expect(onEvict).toHaveBeenCalledTimes(1);
		expect(onEvict).toHaveBeenCalledWith("a", 10);
		expect(cache.get("a")).toBe(20);
	});

	it("calls onEvict for all remaining entries when clear is invoked", () => {
		const onEvict = vi.fn();
		const cache = new LRUCache<string, string>(3, onEvict);

		cache.set("x", "1");
		cache.set("y", "2");
		cache.clear();

		expect(onEvict).toHaveBeenCalledTimes(2);
		expect(onEvict).toHaveBeenCalledWith("x", "1");
		expect(onEvict).toHaveBeenCalledWith("y", "2");
		expect(cache.get("x")).toBeUndefined();
		expect(cache.get("y")).toBeUndefined();
	});
});
