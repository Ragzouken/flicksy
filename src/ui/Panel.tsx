export default interface Panel
{
    /**
     * Show this panel.
     */
    show(): void;

    /**
     * Hide this panel.
     */
    hide(): void;

    /**
     * Force this panel to update to match the internal state.
     */
    refresh(): void;
}
