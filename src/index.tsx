import './index.css';

import * as localForage from 'localforage';
import * as uuid from 'uuid/v4';

import * as utility from './utility';

import { base64ToUint8 } from './Base64';
import { FlicksyProject, FlicksyProjectData } from './data/FlicksyProject';

import FlicksyEditor from './ui/FlicksyEditor';

const editor = new FlicksyEditor(document.getElementById("root")!,
                                 document.getElementById("root")!);

function parseProjectData(json: string): FlicksyProjectData
{
    const data = JSON.parse(json, (key, value) =>
    {
        if (value.hasOwnProperty("_type")
            && value._type == "Uint8ClampedArray")
        {
            return base64ToUint8(value.data);
        }

        return value;
    });

    return data;
}

export function randomisePalette(project: FlicksyProject): void
{
    project.palette.length = 0;

    for (let i = 0; i < 15; ++i)
    {
        const color = utility.rgb2num(utility.randomInt(0, 255), 
                                      utility.randomInt(0, 255),
                                      utility.randomInt(0, 255));
        
        project.palette.push(color);
    }
}

export function loadProject(data: FlicksyProjectData): FlicksyProject
{
    const project = new FlicksyProject();
    project.fromData(data);

    // repairs
    if (project.palette.length < 15)
    {
        randomisePalette(project);
    }

    return project;
}

const sidebar = document.getElementById("sidebar")! as HTMLElement;
const editorButton = document.getElementById("editor-button")! as HTMLElement;

function setEditor()
{
    sidebar.hidden = false;
    editorButton.hidden = true;

    editor.scenesPanel.hide();
    editor.scenesPanel.setPlayTestMode(false);
}

function setPlayback()
{
    sidebar.hidden = true;
    editorButton.hidden = false;

    editor.scenesPanel.setScene(editor.project.scenes[0]);
    editor.scenesPanel.show();
    editor.scenesPanel.setPlayTestMode(true);
}

export function newProject(): FlicksyProject
{
    const project = new FlicksyProject();
    project.name = "unnamed project";
    project.uuid = uuid();
    
    project.createDrawingBoard();
    project.createScene();

    randomisePalette(project);
    
    return project;
}

class ProjectInfo
{ 
    public uuid: string;
    public name: string;
}; 

/** 
 * Get a listing of all saved projects or empty if it doesn't exist yet
 */
export async function getProjectList(): Promise<ProjectInfo[]>
{
    const listing = await localForage.getItem<ProjectInfo[]>("projects");

    return listing || [];
}

/** Save the given project locally and update the saved projects listing */
async function saveProject(project: FlicksyProject): Promise<void>
{
    const listing = await getProjectList();

    // retrieve the existing entry from the listing or create a new one
    let info: ProjectInfo;
    const index = listing.findIndex(info => info.uuid == project.uuid);

    console.log(index);

    if (index >= 0)
    {
        info = listing[index];
    }
    else
    {
        info = new ProjectInfo();
        listing.push(info);
    }

    // update the entry
    info.uuid = project.uuid;
    info.name = project.name;

    // save the new listing, the project data, and last open project
    await localForage.setItem(`projects-${info.uuid}`, project.toData());
    await localForage.setItem("projects", listing);
    await localForage.setItem("last-open", project.uuid);
}

async function findProject(): Promise<FlicksyProject>
{
    // check if there are any saved project listings
    const listing = await getProjectList();
    
    if (listing.length > 0)
    {
        // check for a last-open record, if there is none then default to the
        // first entry. return the loaded project if it exists
        const last = await localForage.getItem<string>("last-open");
        const uuid = last || listing[0].uuid;
        const data = await localForage.getItem<FlicksyProjectData>(`projects-${uuid}`);

        if (data)
        {
            return loadProject(data);
        }
    }
    else
    {
        // check if there's a legacy save, and if there is: resave it
        const data = await localForage.getItem<FlicksyProjectData>("v1-test");

        if (data) 
        {
            const project = loadProject(data);
            await saveProject(project);
            return project;
        }
    }

    // there are no existing saves, so create a new project
    return newProject();
}

function setup()
{
    // tabs
    function hideAll(show?: {show: () => void})
    {
        editor.projectsPanel.hide();
        editor.drawingBoardsPanel.hide();
        editor.scenesPanel.hide();
        editor.publishPanel.hide();

        if (show) show.show();
    }

    hideAll(editor.projectsPanel);

    // tabs
    utility.buttonClick("editor-button",      setEditor);
    utility.buttonClick("playtest-button",    setPlayback);
    utility.buttonClick("info-tab-button",    () => hideAll(editor.projectsPanel));
    utility.buttonClick("publish-tab-button", () => hideAll(editor.publishPanel));
    utility.buttonClick("drawing-tab-button", () => hideAll(editor.drawingBoardsPanel));
    utility.buttonClick("scene-tab-button",   () => hideAll(editor.scenesPanel));

    const save = document.getElementById("save")! as HTMLButtonElement;

    async function doSave()
    {
        save.disabled = true;
        save.textContent = "saving..."

        const delay = utility.delay(500);

        await saveProject(editor.project);
        await delay;

        save.textContent = "saved!";
        await utility.delay(200);
        save.textContent = "save";

        save.disabled = false;
    }

    save.addEventListener("click", () => doSave());

    // play embeded game or open editor
    const embed = document.getElementById("flicksy-data");

    if (embed)
    {
        editor.setProject(loadProject(parseProjectData(embed.innerHTML)));
        setPlayback();
        document.getElementById("editor-button")!.hidden = true;
    }
    else
    {
        findProject().then(p => editor.setProject(p)).then(setEditor);
    }
}

setup();
