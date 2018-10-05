import './index.css';

import * as localForage from 'localforage';
import * as FileSaver from 'file-saver';
import * as uuid from 'uuid/v4';

import * as utility from './utility';

import { base64ToUint8, uint8ToBase64 } from './Base64';

import { MTexture } from './MTexture';
import { FlicksyProject, FlicksyProjectData } from './data/FlicksyProject';

import FlicksyEditor from './ui/FlicksyEditor';

const editor = new FlicksyEditor(document.getElementById("root")!,
                                 document.getElementById("root")!);

let brushColor: number;
let brushSize = 1;

const white = 0xFFFFFFFF;

function doPalette()
{
    const palette = document.getElementById("palette")!;

    for (let i = 0; i < palette.children.length; ++i)
    {
        palette.children[i].addEventListener("click", () => setBrushColor(i));
    }

    const input = document.getElementById("color-input")! as HTMLInputElement;
    input.addEventListener("change", () =>
    {
        const [r, g, b] = utility.hex2rgb(input.value);

        editor.project.palette[paletteIndex] = utility.rgb2num(r, g, b);
        
        refreshPalette();
    });

    refreshPalette();
}

let paletteIndex = 0;

function setBrushColor(index: number)
{
    paletteIndex = index;

    editor.drawingBoardsPanel.erasing = (index == 0);
    brushColor = (index == 0) ? white : editor.project.palette[index];
    editor.drawingBoardsPanel.brush = makeCircleBrush(brushSize, brushColor);
    editor.drawingBoardsPanel.refresh();

    const input = document.getElementById("color-input")! as HTMLInputElement;
    input.hidden = (index == 0);
    input.value = utility.rgb2hex(utility.num2rgb(editor.project.palette[index]));
}

function refreshPalette()
{
    if (!editor.project) return;

    const palette = document.getElementById("palette")!;

    for (let i = 0; i < palette.children.length; ++i)
    {
        const hex = (i == 0) ? "#000000" : utility.num2hex(editor.project.palette[i]);
        const button = palette.children[i];

        button.setAttribute("style", `background-color: ${hex};`);
    }
}

function doBrushes()
{
  const brushes = document.getElementById("brushes")!;
  
  for (let i = 0; i < brushes.children.length; ++i)
  {
    const cell = brushes.children[i];
    const button = cell.children[0];
    button.addEventListener("click", () => 
    {
        brushSize = i + 1;
        editor.drawingBoardsPanel.brush = makeCircleBrush(brushSize, brushColor);
        editor.drawingBoardsPanel.refresh();
    });
  }
}

function makeCircleBrush(circumference: number, color: number): MTexture
{
    const brush = new MTexture(circumference, circumference);
    brush.circleTest(color == 0 ? white : color);

    return brush;
}

function refresh()
{
    editor.refresh(); 

    refreshPalette();
}

function projectToJSON(project: FlicksyProject): string
{
    const json = JSON.stringify(project.toData(), (key, value) =>
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

function randomisePalette(project: FlicksyProject): void
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

function setEditor()
{
    document.getElementById("sidebar")!.hidden = false;
    document.getElementById("editor-button")!.hidden = true;
    editor.scenesPanel.hide();
    editor.scenesPanel.setPlayTestMode(false);
}

function setPlayback()
{
    document.getElementById("sidebar")!.hidden = true;
    editor.scenesPanel.setScene(editor.project.scenes[0]);
    editor.scenesPanel.show();
    editor.scenesPanel.setPlayTestMode(true);

    document.getElementById("editor-button")!.hidden = false;
}

export function setProject(p: FlicksyProject)
{
    editor.setProject(p);

    p.flicksyVersion = "alpha-1";

    setBrushColor(1);

    refresh();
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

export async function exportPlayable(project: FlicksyProject)
{
    // clones the page and inlines the css, javascript, and project data

    const html = document.documentElement.cloneNode(true) as HTMLElement;
    const head = html.getElementsByTagName("head")[0];
    const body = html.getElementsByTagName("body")[0];

    const cssLink = Array.from(html.querySelectorAll("link")).find(e => e.rel == "stylesheet");
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
    data.innerHTML = `\n${projectToJSON(project)}\n`;
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

function setup()
{
    doBrushes();
    doPalette();

    editor.drawingBoardsPanel.brush = makeCircleBrush(1, white);

    utility.buttonClick("reset-palette", () =>
    {
        randomisePalette(editor.project);
        refreshPalette();
    });

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

    const embed = document.getElementById("flicksy-data");

    if (embed)
    {
        setProject(loadProject(parseProjectData(embed.innerHTML)));
        setPlayback();
        document.getElementById("editor-button")!.hidden = true;
    }
    else
    {
        findProject().then(setProject).then(setEditor);
    }
}

setup();
