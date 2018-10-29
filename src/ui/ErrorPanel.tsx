import * as utility from '../tools/utility';

export default class ErrorPanel
{
    private readonly container: HTMLElement;
    private readonly description: HTMLElement;
    private readonly traceback: HTMLElement;

    public constructor()
    {
        this.container = utility.getElement("error");
        this.description = utility.getElement("error-description");
        this.traceback = utility.getElement("error-traceback");
    }

    public show(traceback: string): void
    {
        this.traceback.innerText = traceback;
        this.container.hidden = false;
    }

    public hide(): void
    {
        this.container.hidden = true;
    }
}
