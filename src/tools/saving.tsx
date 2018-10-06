import * as localForage from 'localforage';
import * as uuid4 from 'uuid/v4';
import { FlicksyProject, FlicksyProjectData } from "../data/FlicksyProject";
import { base64ToUint8 } from "./base64";
import * as utility from './utility';

export async function loadProjectFromUUID(uuid: string): Promise<FlicksyProject>
{
    const data = await localForage.getItem<FlicksyProjectData>(`projects-${uuid}`);
    const project = loadProject(data);
    
    return project;
}

export function jsonToProject(json: string): FlicksyProject
{
    const data = parseProjectData(json);
    const project = loadProject(data);

    return project;
}

export function parseProjectData(json: string): FlicksyProjectData
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
    project.createScene();

    randomisePalette(project);
    
    return project;
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
