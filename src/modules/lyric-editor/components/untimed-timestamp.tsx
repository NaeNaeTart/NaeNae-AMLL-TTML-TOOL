import styles from "./index.module.css";

/** "--:--.---", sized by an invisible real timestamp so untimed pills match timed ones. */
export const UntimedTimestamp = () => (
	<span className={styles.untimedText}>
		<span aria-hidden className={styles.timestampSizer}>
			00:00.000
		</span>
		<span>--:--.---</span>
	</span>
);
