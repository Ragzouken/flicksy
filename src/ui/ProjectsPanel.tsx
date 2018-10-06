import { getProjectList, jsonToProject, loadProjectFromUUID, newProject } from "../tools/saving";
import * as utility from '../tools/utility';
import FlicksyEditor from "./FlicksyEditor";
import Panel from "./Panel";

export default class ProjectsPanel implements Panel
{
    private readonly sidebar: HTMLElement;
    private readonly projectNameInput: HTMLInputElement;
    private readonly projectSelect: HTMLSelectElement;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sidebar = document.getElementById("info")! as HTMLElement;
        this.projectNameInput = document.getElementById("project-name")! as HTMLInputElement;
        this.projectSelect = document.getElementById("open-project-select")! as HTMLSelectElement;

        // rename project
        this.projectNameInput.addEventListener("change", () =>
        {
            editor.project.name = this.projectNameInput.value;
        });

        // create blank new project
        utility.buttonClick("new-project", () => this.editor.setProject(newProject()));
        
        // open saved project
        this.projectSelect.addEventListener("change", () => 
        {
            loadProjectFromUUID(this.projectSelect.value);
        });

        // import project data
        const importButton = document.getElementById("import-data")! as HTMLInputElement;
        importButton.addEventListener("change", () =>
        {
            if (importButton.files && importButton.files[0])
            {
                const file = importButton.files[0];
                const reader = new FileReader();

                reader.onload = progress =>
                {
                    const project = jsonToProject(reader.result as string);
                    this.editor.setProject(project);
                };

                reader.readAsText(file);
            }
        });
    }

    public refresh(): void
    {
        // copy project name to name input
        this.projectNameInput.value = this.editor.project.name;

        // refresh saved project menu
        getProjectList().then(listing =>
        {
            utility.repopulateSelect(this.projectSelect, 
                                    listing.map(info => ({label: info.name, value: info.uuid})),
                                    "select project");

            if (this.editor.project)
            {
                this.projectSelect.value = this.editor.project.uuid;
            }
        });
    }

    public show(): void
    {
        this.sidebar.hidden = false;
    }

    public hide(): void
    {
        this.sidebar.hidden = true;
    }
}
