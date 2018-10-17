import * as utility from '../tools/utility';
import FlicksyEditor from "./FlicksyEditor";

export default class PickerPanel
{
    private readonly siderbar: HTMLElement;
    private readonly headingText: HTMLElement;
    private readonly contextText: HTMLElement;
    private readonly queryInput: HTMLInputElement;
    private readonly queryCancel: HTMLButtonElement;

    /** Called when the search query changes from user input */
    private onQueryChange: (query: string) => void;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.siderbar = utility.getElement("picker-sidebar");
        this.headingText = utility.getElement("picker-heading");
        this.contextText = utility.getElement("picker-context");
        this.queryInput = utility.getElement("picker-query-input");
        this.queryCancel = utility.getElement("picker-query-cancel");

        this.queryInput.addEventListener("input", () => this.setQuery(this.queryInput.value));
        this.queryCancel.addEventListener("click", () => this.setQuery(""));
    }

    /**
     * Open this panel with the given heading text and context text. The
     * provided callback will be called whenever the query is changed by
     * user input.
     */
    public pick(heading: string,
                context: string, 
                onQueryChange: (query: string) => void): void 
    {
        this.headingText.innerHTML = heading;
        this.contextText.innerHTML = context;
        this.onQueryChange = onQueryChange;
        this.setQuery("");

        this.siderbar.hidden = false;
    }
    
    /**
     * Hide this panel.
     */
    public hide(): void 
    {
        this.siderbar.hidden = true;
    }

    /**
     * Set the query string for the panel, disabling the reset button if there
     * is no query to reset, and calling back to notify the embedding panel
     * that the query changed.
     */
    private setQuery(query: string): void
    {
        this.queryInput.value = query;
        this.queryCancel.disabled = query.length === 0;
        this.onQueryChange(query);
    }
}
