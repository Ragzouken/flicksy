import * as localForage from 'localforage'; 
import { base64ToUint8, uint8ToBase64 } from '../Base64';

import * as utility from '../utility';

import FlicksyEditor from "./FlicksyEditor";

import { FlicksyProjectData } from '../data/FlicksyProject';
import { getProjectList, newProject, setProject, loadProject } from "../index"; 

export default class ProjectsPanel
{
    private readonly editor: FlicksyEditor;

    private readonly sidebar: HTMLElement;
    private readonly projectNameInput: HTMLInputElement;
    private readonly projectSelect: HTMLSelectElement;

    public constructor(editor: FlicksyEditor)
    {
        this.editor = editor;

        this.sidebar = document.getElementById("info")! as HTMLElement;
        this.projectNameInput = document.getElementById("project-name")! as HTMLInputElement;
        this.projectSelect = document.getElementById("open-project-select")! as HTMLSelectElement;

        this.projectNameInput.addEventListener("change", () =>
        {
            editor.project.name = this.projectNameInput.value;
        });

        utility.buttonClick("new-project", () =>
        {
            setProject(newProject());
        });

        this.projectSelect.addEventListener("change", () =>
        {
            const uuid = this.projectSelect.value;
    
            // TODO: do actual loading somewhere centralised
            localForage.getItem<FlicksyProjectData>(`projects-${uuid}`).then(data =>
            {
                if (data)
                {
                    setProject(loadProject(data));
                } 
            });
        });

        const importButton = document.getElementById("import-data")! as HTMLInputElement;
        importButton.addEventListener("change", () =>
        {
            if (importButton.files && importButton.files[0])
            {
                const file = importButton.files[0];
                const reader = new FileReader();

                reader.onload = progress =>
                {
                    const data = JSON.parse(reader.result as string, (key, value) =>
                    {
                        if (value.hasOwnProperty("_type")
                        && value._type == "Uint8ClampedArray")
                        {
                            return base64ToUint8(value.data);
                        }

                        return value;
                    });

                    setProject(loadProject(data));
                };
                reader.readAsText(file);
            }
        });
    }

    public refresh(): void
    {
        this.projectNameInput.value = this.editor.project.name;

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
