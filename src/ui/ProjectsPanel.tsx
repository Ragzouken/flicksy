import { fileToProject, getProjectList, loadProjectFromUUID, newProject } from "../tools/saving";
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
        this.sidebar = utility.getElement("info");
        this.projectNameInput = utility.getElement("project-name");
        this.projectSelect = utility.getElement("open-project-select");

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
            loadProjectFromUUID(this.projectSelect.value).then(project =>
            {
                this.editor.setProject(project);
            });
        });

        // import project data
        const importButton = document.getElementById("import-data")! as HTMLInputElement;
        importButton.addEventListener("change", () =>
        {
            if (importButton.files && importButton.files[0])
            {
                fileToProject(importButton.files[0])
                .then(project => this.editor.setProject(project));
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
