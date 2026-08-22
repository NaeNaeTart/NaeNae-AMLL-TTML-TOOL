import {
	BookSearchRegular,
	DismissRegular,
	SearchRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Flex,
	Heading,
	IconButton,
	Link,
	ScrollArea,
	Spinner,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { urbanDictionaryDialogAtom } from "$/states/urban-dictionary";

interface Definition {
	definition: string;
	permalink: string;
	thumbs_up: number;
	author: string;
	word: string;
	defid: number;
	example: string;
	thumbs_down: number;
}

export const UrbanDictionaryDialog = () => {
	const { t } = useTranslation();
	const [state, setState] = useAtom(urbanDictionaryDialogAtom);
	const [definitions, setDefinitions] = useState<Definition[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (state.open && state.word) {
			setLoading(true);
			setError(null);
			fetch(
				`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(state.word)}`,
			)
				.then((res) => res.json())
				.then((data) => {
					setDefinitions(data.list || []);
					setLoading(false);
				})
				.catch((err) => {
					console.error("Failed to fetch Urban Dictionary definitions", err);
					setError("Failed to reach Urban Dictionary");
					setLoading(false);
				});
		} else {
			setDefinitions([]);
		}
	}, [state.open, state.word]);

	const handleClose = () => {
		setState({ ...state, open: false });
	};

	return (
		<>
			{state.open && (
				<Box
					style={{
						position: "fixed",
						inset: 0,
						backgroundColor: "rgba(0,0,0,0.5)",
						zIndex: 1000,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backdropFilter: "blur(2px)",
					}}
					onClick={handleClose}
				>
					<Box
						style={{
							backgroundColor: "var(--color-panel)",
							borderRadius: "12px",
							maxWidth: "600px",
							width: "calc(100vw - 40px)",
							maxHeight: "85vh",
							overflow: "hidden",
							boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
							border: "1px solid var(--gray-5)",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<Flex
							align="center"
							justify="between"
							style={{
								padding: "16px 20px",
								borderBottom: "1px solid var(--gray-5)",
								backgroundColor: "var(--gray-2)",
							}}
						>
							<Flex align="center" gap="2">
								<BookSearchRegular
									style={{ fontSize: "20px", color: "var(--accent-9)" }}
								/>
								<Heading size="3">{t("urbanDictionary.title")}</Heading>
							</Flex>
							<IconButton
								size="1"
								variant="ghost"
								onClick={handleClose}
								color="gray"
							>
								<DismissRegular />
							</IconButton>
						</Flex>

						<Box style={{ padding: "16px 24px 8px 24px" }}>
							<Flex align="baseline" gap="2">
								<Text
									size="6"
									weight="bold"
									style={{ letterSpacing: "-0.02em", color: "var(--accent-9)" }}
								>
									{state.word}
								</Text>
								<Text size="2" color="gray" style={{ opacity: 0.8 }}>
									{t("urbanDictionary.slang")}
								</Text>
							</Flex>
						</Box>

						<ScrollArea style={{ maxHeight: "65vh" }} type="auto">
							<Box style={{ padding: "8px 24px 24px 24px" }}>
								{loading ? (
									<Flex align="center" justify="center" height="200px">
										<Spinner size="3" />
									</Flex>
								) : error ? (
									<Flex
										direction="column"
										align="center"
										justify="center"
										gap="3"
										height="200px"
									>
										<Text color="red" size="2">
											{error}
										</Text>
									</Flex>
								) : definitions.length === 0 ? (
									<Flex
										direction="column"
										align="center"
										justify="center"
										gap="3"
										height="200px"
										style={{ opacity: 0.5 }}
									>
										<SearchRegular style={{ fontSize: "40px" }} />
										<Text size="2">
											{t("urbanDictionary.noDefinitions", { word: state.word })}
										</Text>
									</Flex>
								) : (
									<Flex direction="column" gap="4">
										{definitions.map((def) => (
											<Box
												key={def.defid}
												style={{
													padding: "16px",
													backgroundColor: "var(--gray-3)",
													borderRadius: "10px",
													borderLeft: "4px solid var(--accent-9)",
													boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
												}}
											>
												<Flex direction="column" gap="3">
													<Text
														size="3"
														style={{
															whiteSpace: "pre-wrap",
															lineHeight: "1.6",
															wordBreak: "break-word",
														}}
													>
														{def.definition.replace(/\[|\]/g, "")}
													</Text>
													{def.example && (
														<Box
															style={{
																padding: "12px",
																backgroundColor: "var(--gray-4)",
																borderRadius: "8px",
																borderLeft: "2px solid var(--gray-7)",
															}}
														>
															<Text
																size="2"
																color="gray"
																style={{
																	whiteSpace: "pre-wrap",
																	fontStyle: "italic",
																	lineHeight: "1.5",
																	wordBreak: "break-word",
																}}
															>
																"{def.example.replace(/\[|\]/g, "")}"
															</Text>
														</Box>
													)}
													<Flex
														justify="between"
														align="center"
														style={{ marginTop: "4px" }}
													>
														<Text
															size="1"
															color="gray"
															style={{ opacity: 0.7 }}
														>
															{t("urbanDictionary.by")} {def.author} • 👍{" "}
															{def.thumbs_up}
														</Text>
														<Link
															href={def.permalink}
															target="_blank"
															size="1"
															style={{ fontWeight: 500 }}
														>
															{t("urbanDictionary.viewOnline")}
														</Link>
													</Flex>
												</Flex>
											</Box>
										))}
									</Flex>
								)}
							</Box>
						</ScrollArea>
					</Box>
				</Box>
			)}
		</>
	);
};
