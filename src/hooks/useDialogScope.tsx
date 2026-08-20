import { Flex, RadioGroup, Text, TextField } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import type { LyricLine } from "$/types/ttml";

export type DialogScopeType =
	| "all"
	| "selected"
	| "selected-following"
	| "custom";

export function resolveTargetLineIndices(
	scope: DialogScopeType,
	lines: LyricLine[],
	selectedLines: Set<string>,
	customStart: string,
	customEnd: string,
): Set<number> {
	const totalLines = lines.length;
	const targetLineIndices = new Set<number>();

	if (scope === "all") {
		for (let i = 0; i < totalLines; i++) {
			targetLineIndices.add(i);
		}
	} else if (scope === "selected") {
		lines.forEach((line, index) => {
			if (selectedLines.has(line.id)) {
				targetLineIndices.add(index);
			}
		});
	} else if (scope === "selected-following") {
		let firstSelectedIndex = -1;
		lines.forEach((line, index) => {
			if (selectedLines.has(line.id)) {
				if (firstSelectedIndex === -1 || index < firstSelectedIndex) {
					firstSelectedIndex = index;
				}
			}
		});
		if (firstSelectedIndex !== -1) {
			for (let i = firstSelectedIndex; i < totalLines; i++) {
				targetLineIndices.add(i);
			}
		}
	} else if (scope === "custom") {
		const start = parseInt(customStart, 10);
		const end = parseInt(customEnd, 10);
		if (!Number.isNaN(start) && !Number.isNaN(end)) {
			for (let i = Math.max(0, start - 1); i < Math.min(totalLines, end); i++) {
				targetLineIndices.add(i);
			}
		}
	}

	return targetLineIndices;
}

export function useDialogScope(open: boolean) {
	const lyricLines = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);

	const [scope, setScope] = useState<DialogScopeType>("all");
	const [customStart, setCustomStart] = useState("1");
	const [customEnd, setCustomEnd] = useState("1");

	const hasSelection = selectedLines.size > 0;
	const totalLines = lyricLines.lyricLines.length;

	useEffect(() => {
		if (open) {
			if (hasSelection) {
				setScope("selected");
			} else {
				setScope("all");
			}
			setCustomEnd(totalLines.toString());
		}
	}, [open, hasSelection, totalLines]);

	const getTargetLineIndices = useCallback((): Set<number> => {
		return resolveTargetLineIndices(
			scope,
			lyricLines.lyricLines,
			selectedLines,
			customStart,
			customEnd,
		);
	}, [customEnd, customStart, lyricLines.lyricLines, scope, selectedLines]);

	return {
		scope,
		setScope: (v: DialogScopeType) => setScope(v),
		customStart,
		setCustomStart,
		customEnd,
		setCustomEnd,
		hasSelection,
		selectedCount: selectedLines.size,
		totalLines,
		getTargetLineIndices,
	};
}

export type UseDialogScopeResult = ReturnType<typeof useDialogScope>;

export const DialogScopeSelector = ({
	scope,
	setScope,
	customStart,
	setCustomStart,
	customEnd,
	setCustomEnd,
	hasSelection,
	selectedCount,
}: UseDialogScopeResult) => {
	const { t } = useTranslation();

	return (
		<Flex direction="column" gap="2">
			<Text size="2" weight="bold">
				{t("common.applyScope", "Aplicar a")}
			</Text>
			<RadioGroup.Root value={scope} onValueChange={setScope}>
				<RadioGroup.Item value="all">
					{t("common.scope.all", "Todas las líneas")}
				</RadioGroup.Item>

				<RadioGroup.Item value="selected" disabled={!hasSelection}>
					{t("common.scope.selected", "Líneas seleccionadas")}
					{hasSelection && ` (${selectedCount})`}
				</RadioGroup.Item>

				<RadioGroup.Item value="selected-following" disabled={!hasSelection}>
					{t("common.scope.selectedFollowing", "Línea seleccionada y siguientes")}
				</RadioGroup.Item>

				<RadioGroup.Item value="custom">
					{t("common.scope.custom", "Rango personalizado")}
				</RadioGroup.Item>
			</RadioGroup.Root>

			{scope === "custom" && (
				<Flex align="center" gap="2" ml="4">
					<Text size="2">{t("common.fromLine", "Desde")}</Text>
					<TextField.Root
						style={{ width: "60px" }}
						size="1"
						type="number"
						value={customStart}
						onChange={(e) => setCustomStart(e.target.value)}
					/>
					<Text size="2">{t("common.toLine", "hasta")}</Text>
					<TextField.Root
						style={{ width: "60px" }}
						size="1"
						type="number"
						value={customEnd}
						onChange={(e) => setCustomEnd(e.target.value)}
					/>
					<Text size="2">{t("common.line", "línea")}</Text>
				</Flex>
			)}
		</Flex>
	);
};