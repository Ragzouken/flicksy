import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { fileToProject, getProjectList, loadProjectFromUUID, newProject } from "../tools/saving";
import * as utility from '../tools/utility';
import FlicksyEditor from "./FlicksyEditor";
import Panel from "./Panel";

export default class ProjectsPanel implements Panel
{
    private readonly sidebar: HTMLElement;
    private projectNameInput: HTMLInputElement;
    private resolutionSelect: HTMLSelectElement;
    private projectSelect: HTMLSelectElement;

    public constructor(private readonly editor: FlicksyEditor)
    {
        const import_ = (files: FileList | null) =>
        {
            if (files && files[0])
            {
                fileToProject(files[0]).then(project => this.editor.setProject(project));
            }
        };

        const changeProject = (uuid: string) =>
        {
            loadProjectFromUUID(this.projectSelect.value).then(project =>
            {
                this.editor.setProject(project);
            });
        };

        const changeResolution = (resolution: string) =>
        {
            const [width, height] = resolution.split("x").map(part => +part);

            this.editor.project.resolution = [width, height];
            this.editor.refresh();
        };

        const sidebar = <>
            <div className="section">
                <h1>flicksy</h1>
                <p>a tool for drawing and assembling graphical hypertext games</p>
                <h2>getting started</h2>    
                <ol>
                    <li>create some drawings in the <em>drawings</em> tab above</li>
                    <li>compose a scene in the <em>scenes</em> tab above</li>
                    <li>playtest by click the <em>play</em> button above</li>
                    <li>export a playable game in the <em>publish</em> tab above</li>
                </ol>
            </div>
            <div className="section">
                <h1>project details</h1>
                <h2>name</h2>
                <input id="project-name" 
                       className="full-input" 
                       title="Rename this project" 
                       ref={element => this.projectNameInput = element!}
                       onChange={event => editor.project.name = event.target.value}/>
                <h2>resolution</h2>
                <select title="Pixel size of all scenes"
                        ref={element => this.resolutionSelect = element!}
                        onChange={event => changeResolution(event.target.value)}>
                    <option value="160x100">160px x 100px (default)</option>
                    <option value="320x200">320px x 200px</option>
                    <option value="256x256">256px x 256px</option>
                </select>
            </div>
            <div className="section">
                <h1>switch project</h1>
                <h2>reset to blank project</h2>
                <button title="Discard the existing project save and start a blank new project"
                        onClick={() => this.editor.setProject(newProject())}>
                    new project
                </button>
                <h2>open another project</h2>
                <select title="Open another saved project"
                        ref={element => this.projectSelect = element!}
                        onChange={event => changeProject(event.target.value)} />
                <h2>import project data</h2>
                <input type="file" 
                       accept="application/json" 
                       title="Load a project from previous exported text file"
                       onChange={event => import_(event.target.files)} />
            </div>
        </>;

        this.sidebar = utility.getElement("info");

        ReactDOM.render(sidebar, utility.getElement("info"))
    }

    public refresh(): void
    {
        // copy project name to name input
        this.projectNameInput.value = this.editor.project.name;

        this.resolutionSelect.value = this.editor.project.resolution.join("x");

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
