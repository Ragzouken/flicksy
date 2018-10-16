import * as utility from '../tools/utility';
import FlicksyEditor from "./FlicksyEditor";

export default class PickerPanel
{
    private readonly siderbar: HTMLElement;
    private readonly headingText: HTMLElement;
    private readonly contextText: HTMLElement;
    private readonly queryInput: HTMLInputElement;
    private readonly queryCancel: HTMLButtonElement;

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

    public pick(heading: string,
                context: string, 
                onQueryChange: (query: string) => void): void 
    {
        this.siderbar.hidden = false;

        this.headingText.innerHTML = heading;
        this.contextText.innerHTML = context;
        this.queryInput.value = "";
        this.queryCancel.disabled = true;
        this.onQueryChange = onQueryChange;
    }
    
    public hide(): void 
    {
        this.siderbar.hidden = true;
    }

    private setQuery(query: string): void
    {
        this.queryInput.value = query;
        this.queryCancel.disabled = query.length === 0;
        this.onQueryChange(query);
    }
}
