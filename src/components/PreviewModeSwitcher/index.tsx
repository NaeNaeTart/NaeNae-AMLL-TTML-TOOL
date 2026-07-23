import { useAtomValue } from "jotai";
import { Suspense } from "react";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import {
	PreviewModeType,
	previewModeTypeAtom,
} from "$/modules/settings/states/preview";
import { lazy } from "$/utils/lazy.ts";

const AMLLWrapper = lazy(() => import("$/components/AMLLWrapper"));
const AMLL = lazy(() => import("$/components/AMLLWrapper/AMLL"));
const TimingOverview = lazy(() => import("$/components/TimingOverview"));
const SpicyLyrics = lazy(() => import("$/components/SpicyLyrics"));

export const PreviewModeSwitcher = () => {
	const previewModeType = useAtomValue(previewModeTypeAtom);

	return (
		<Suspense fallback={<SuspensePlaceHolder />}>
			{previewModeType === PreviewModeType.Standard && (
				<AMLLWrapper variant="standard" />
			)}
			{previewModeType === PreviewModeType.AMLL && <AMLL />}
			{previewModeType === PreviewModeType.Toxi && (
				<AMLLWrapper variant="toxi" />
			)}
			{previewModeType === PreviewModeType.Spicy && <SpicyLyrics />}
			{previewModeType === PreviewModeType.Timing && <TimingOverview />}
		</Suspense>
	);
};

export default PreviewModeSwitcher;
