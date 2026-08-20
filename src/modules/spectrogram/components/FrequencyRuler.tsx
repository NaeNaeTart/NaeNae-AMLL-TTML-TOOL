import type { FC } from "react";
import { useAtomValue } from "jotai";
import { audioBufferAtom } from "$/modules/audio/states";
import { Text } from "@radix-ui/themes";

export const FrequencyRuler: FC = () => {
	const audioBuffer = useAtomValue(audioBufferAtom);

	if (!audioBuffer) return null;

	const nyquist = audioBuffer.sampleRate / 2;

	const labels = [
		0,
		500,
		1000,
		2000,
		5000,
		10000,
		20000,
		nyquist
	].filter(f => f <= nyquist);

	const uniqueLabels = Array.from(new Set(labels)).sort((a, b) => b - a);

	return (
		<div style={{ 
			position: "absolute", 
			left: 0, 
			top: 0, 
			bottom: 0, 
			width: "100%", 
			height: "100%",
			pointerEvents: "none",
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
			padding: "4px 0"
		}}>
			{uniqueLabels.map((freq) => {
				const yPercent = (1 - freq / nyquist) * 100;
				return (
					<div 
						key={freq}
						style={{ 
							position: "absolute", 
							top: `${yPercent}%`, 
							width: "100%",
							borderTop: "1px solid var(--gray-5)",
							paddingLeft: "4px"
						}}
					>
						<Text size="1" color="gray" style={{ 
							fontSize: "9px", 
							lineHeight: "1",
							transform: "translateY(-50%)",
							backgroundColor: "var(--gray-2)",
							paddingRight: "2px"
						}}>
							{freq >= 1000 ? `${freq / 1000}k` : freq}
						</Text>
					</div>
				);
			})}
		</div>
	);
};