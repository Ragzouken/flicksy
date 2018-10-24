import * as FileSaver from 'file-saver';
import * as localForage from 'localforage';
import * as uuid4 from 'uuid/v4';
import { FlicksyProject, FlicksyProjectData } from "../data/FlicksyProject";
import { base64ToUint8, uint8ToBase64 } from "./base64";
import * as utility from './utility';

export function repairProject(project: FlicksyProject): void
{
    if (!project.startScene)
    {
        project.startScene = project.scenes[0].uuid;
    }

    // palette
    if (project.palette.length < 15)
    {
        randomisePalette(project);
    }

    // scene map
    project.sceneBoards = project.sceneBoards || [];

    if (project.sceneBoards.length === 0)
    {
        project.createSceneBoard();
    }
}

export async function loadProjectFromUUID(uuid: string): Promise<FlicksyProject>
{
    const data = await localForage.getItem<FlicksyProjectData>(`projects-${uuid}`);
    const project = loadProject(data);
    
    return project;
}

export function jsonToProject(json: string): FlicksyProject
{
    const data = jsonToProjectData(json);
    const project = loadProject(data);

    return project;
}

export function projectToJson(project: FlicksyProject): string
{
    return projectDataToJson(project.toData());
}

export function fileToProject(file: File): Promise<FlicksyProject>
{
    return new Promise((resolve, reject) =>
    {
        const reader = new FileReader();

        reader.onload = progress =>
        {
            const project = jsonToProject(reader.result as string);
            
            resolve(project);
        };

        reader.readAsText(file);
    });
}

export function projectDataToJson(data: FlicksyProjectData): string
{
    const json = JSON.stringify(data, (key, value) =>
    {
        if (value instanceof Uint8ClampedArray)
        {
            return { "_type": "Uint8ClampedArray", "data": uint8ToBase64(value) }
        }
        else
        {
            return value;
        }
    });

    return json;
} 

export function jsonToProjectData(json: string): FlicksyProjectData
{
    const data = JSON.parse(json, (key, value) =>
    {
        if (value.hasOwnProperty("_type")
            && value._type === "Uint8ClampedArray")
        {
            return base64ToUint8(value.data);
        }

        return value;
    });

    return data;
}

export function newProject(): FlicksyProject
{
    const project = new FlicksyProject();
    project.name = "unnamed project";
    project.uuid = uuid4();
    
    project.createDrawingBoard();
    project.createSceneBoard();
    project.createScene();

    project.startScene = project.scenes[0].uuid;

    randomisePalette(project);
    
    return project;
}

export function loadProject(data: FlicksyProjectData): FlicksyProject
{
    const project = new FlicksyProject();
    project.fromData(data);

    repairProject(project);
    
    project.flicksyVersion = "alpha-1";

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
export async function saveProject(project: FlicksyProject): Promise<void>
{
    // save the project as it was at the time the save button was clicked
    const data = project.toData();

    const listing = await getProjectList();

    // retrieve the existing entry from the listing or create a new one
    const index = listing.findIndex(i => i.uuid === project.uuid);

    let info: ProjectInfo;

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
    await localForage.setItem(`projects-${info.uuid}`, data);
    await localForage.setItem("projects", listing);
    await localForage.setItem("last-open", project.uuid);
}

export async function findProject(): Promise<FlicksyProject>
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

export async function exportPlayable(project: FlicksyProject)
{
    // clones the page and inlines the css, javascript, and project data
    const html = document.documentElement!.cloneNode(true) as HTMLElement;
    const head = html.getElementsByTagName("head")[0];
    const body = html.getElementsByTagName("body")[0];

    const cssLink = Array.from(html.querySelectorAll("link")).find(e => e.rel === "stylesheet");
    const jsScript = html.querySelector("script");

    // hide sidebar and editor button
    (body.querySelector("#sidebar")! as HTMLDivElement).hidden = true;
    (body.querySelector("#editor-button")! as HTMLButtonElement).hidden = true;

    // remove existing canvas
    const canvas = body.getElementsByTagName("canvas")[0];
    canvas.parentElement!.removeChild(canvas);

    // inline css
    if (cssLink)
    {
        const cssText = await fetch(cssLink.href).then(response => response.text());
        
        cssLink.parentElement!.removeChild(cssLink);
        const style = document.createElement("style");
        style.innerHTML = cssText;
        head.appendChild(style);
    }
    
    // inline project (before js so it's loaded before scripts run)
    const data = document.createElement("script") as HTMLScriptElement;
    data.id = "flicksy-data";
    data.type = "text/flicksy";
    data.innerHTML = `\n${projectToJson(project)}\n`;
    body.appendChild(data);

    // inline js
    if (jsScript)
    {
        const jsText = await fetch(jsScript.src).then(response => response.text());

        jsScript.removeAttribute("src");
        jsScript.innerHTML = jsText;
        body.appendChild(jsScript);
    }
    
    // save html
    const name = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const blob = new Blob([html.innerHTML], {type: "text/html"});
    FileSaver.saveAs(blob, `flicksy-${name}.html`);

    return;
}
