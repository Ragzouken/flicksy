import './index.css';

import * as localForage from 'localforage';
import * as Pixi from 'pixi.js';
import * as JSZip from 'jszip';
import * as FileSaver from 'file-saver';
import * as uuid from 'uuid/v4';

import * as utility from './utility';

import { base64ToUint8, uint8ToBase64 } from './Base64';

import DrawingBoardsPanel from './ui/DrawingBoardsPanel';
import { MTexture } from './MTexture';
import { FlicksyProject, FlicksyProjectData } from './data/FlicksyProject';
import ScenesPanel from './ui/ScenesPanel';

const pixi = new Pixi.Application(320, 240, { transparent: true });
document.getElementById("root")!.appendChild(pixi.view);
pixi.start();

function rgb2num(r: number, g: number, b: number, a: number = 255)
{
  return ((a << 24) | (b << 16) | (g << 8) | (r)) >>> 0;
}

function num2rgb(value: number): [number, number, number]
{
    const r = (value >>  0) & 0xFF;
    const g = (value >>  8) & 0xFF;
    const b = (value >> 16) & 0xFF;
    
    return [r, g, b];
}

function rgb2hex(color: [number, number, number]): string
{
    const [r, g, b] = color;
    let rs = r.toString(16);
    let gs = g.toString(16);
    let bs = b.toString(16);

    if (rs.length < 2) rs = "0" + rs;
    if (gs.length < 2) gs = "0" + gs;
    if (bs.length < 2) bs = "0" + bs;

    return `#${rs}${gs}${bs}`;
}

function hex2rgb(color: string): [number, number, number]
{
    const matches = color.match(/^#([0-9a-f]{6})$/i);

    if (matches) 
    {
        const match = matches[1];

        return [
            parseInt(match.substr(0,2),16),
            parseInt(match.substr(2,2),16),
            parseInt(match.substr(4,2),16)
        ];
    }
    
    return [0, 0, 0];
}

function randomInt(min: number, max: number){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let brushColor = 0xFF00FF;
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
        const [r, g, b] = hex2rgb(input.value);

        project.palette[paletteIndex] = rgb2num(r, g, b);
        
        refreshPalette();
    });

    refreshPalette();
}

let paletteIndex = 0;

function setBrushColor(index: number)
{
    paletteIndex = index;

    drawingBoardsPanel.erasing = (index == 0);
    brushColor = (index == 0) ? 0xFFFFFFFF : project.palette[index];
    drawingBoardsPanel.brush = makeCircleBrush(brushSize, brushColor);
    drawingBoardsPanel.refresh();

    const input = document.getElementById("color-input")! as HTMLInputElement;
    input.hidden = (index == 0);
    input.value = rgb2hex(num2rgb(project.palette[index]));
}

function refreshPalette()
{
    if (!project) return;

    const palette = document.getElementById("palette")!;

    for (let i = 0; i < palette.children.length; ++i)
    {
        let r = 0, g = 0, b = 0, c = 0;
        const button = palette.children[i];

        if (i != 0)
        {
            c = project.palette[i];
            [r, g, b] = num2rgb(c);
        }

        button.setAttribute("style", `background-color: rgb(${r},${g},${b});`);
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
        drawingBoardsPanel.brush = makeCircleBrush(brushSize, brushColor);
        drawingBoardsPanel.refresh();
    });
  }
}

function makeCircleBrush(circumference: number, color: number): MTexture
{
    const brush = new MTexture(circumference, circumference);
    brush.circleTest(color == 0 ? white : color);

    return brush;
}

let project: FlicksyProject;
let drawingBoardsPanel: DrawingBoardsPanel;
let scenesPanel: ScenesPanel;

function refresh()
{
    (document.getElementById("project-name")! as HTMLInputElement).value = project.name;

    drawingBoardsPanel.refresh();
    scenesPanel.refresh();
    refreshPalette();

    const select = document.getElementById("open-project-select")! as HTMLSelectElement;

    getProjectList().then(listing =>
    {
        utility.repopulateSelect(select, 
                                 listing.map(info => ({label: info.name, value: info.uuid})),
                                 "select project");

        if (project)
        {
            select.value = project.uuid;
        }
    });
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
        const color = rgb2num(randomInt(0, 255), 
                              randomInt(0, 255),
                              randomInt(0, 255));
        
        project.palette.push(color);
    }
}

function loadProject(data: FlicksyProjectData): FlicksyProject
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
    scenesPanel.hide();
    scenesPanel.setPlayTestMode(false);
}

function setPlayback()
{
    document.getElementById("sidebar")!.hidden = true;
    scenesPanel.setScene(project.scenes[0]);
    scenesPanel.show();
    scenesPanel.setPlayTestMode(true);

    document.getElementById("editor-button")!.hidden = bundled;
}

function setProject(p: FlicksyProject)
{
    project = p;

    drawingBoardsPanel.setProject(p);
    drawingBoardsPanel.setDrawingBoard(p.drawingBoards[0]);
    
    scenesPanel.setProject(p);
    scenesPanel.setScene(p.scenes[0]);

    p.flicksyVersion = "alpha-1";

    setBrushColor(1);

    refresh();
}

function newProject(): FlicksyProject
{
    const project = new FlicksyProject();
    project.name = "unnamed project";
    project.uuid = uuid();
    
    project.createDrawingBoard();
    project.createScene();
    
    return project;
}

let bundled: boolean;

class ProjectInfo
{ 
    public uuid: string;
    public name: string;
}; 

/** 
 * Get a listing of all saved projects or empty if it doesn't exist yet
 */
async function getProjectList(): Promise<ProjectInfo[]>
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
    const embed = document.getElementById("flicksy-data");

    if (embed)
    {
        bundled = true;
        return loadProject(parseProjectData(embed.innerHTML));
    }

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

async function exportPlayable(project: FlicksyProject)
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

    const projectNameInput = document.getElementById("project-name")! as HTMLInputElement;

    projectNameInput.addEventListener("change", () =>
    {
        project.name = projectNameInput.value;
    });

    drawingBoardsPanel = new DrawingBoardsPanel(pixi);
    drawingBoardsPanel.hide();

    drawingBoardsPanel.brush = makeCircleBrush(1, 0xFFFFFFFF);
    scenesPanel = new ScenesPanel(pixi);

    const info = document.getElementById("info")! as HTMLDivElement;
    const publish = document.getElementById("publish")! as HTMLDivElement;

    function hideAll()
    {
        drawingBoardsPanel.hide();
        scenesPanel.hide();
        info.hidden = true;
        publish.hidden = true;
    }

    hideAll();

    info.hidden = false;    
    document.getElementById("editor-button")!.hidden = true;

    // tabs
    utility.buttonClick("editor-button",      setEditor);
    utility.buttonClick("playtest-button",    setPlayback);
    utility.buttonClick("info-tab-button",    () => { hideAll(); info.hidden = false;       });
    utility.buttonClick("publish-tab-button", () => { hideAll(); publish.hidden = false;    });
    utility.buttonClick("drawing-tab-button", () => { hideAll(); drawingBoardsPanel.show(); });
    utility.buttonClick("scene-tab-button",   () => { hideAll(); scenesPanel.show();        });

    utility.buttonClick("reset-palette", () =>
    {
        randomisePalette(project);
        refreshPalette();
    });

    const select = document.getElementById("open-project-select")! as HTMLSelectElement;
    select.addEventListener("change", () =>
    {
        const uuid = select.value;

        localForage.getItem<FlicksyProjectData>(`projects-${uuid}`).then(data =>
        {
            if (data)
            {
                setProject(loadProject(data));
            } 
        });
    });

    const save = document.getElementById("save")! as HTMLButtonElement;

    async function doSave()
    {
        save.disabled = true;
        save.textContent = "saving..."

        const delay = utility.delay(500);

        await saveProject(project);
        await delay;

        save.textContent = "saved!";
        await utility.delay(200);
        save.textContent = "save";

        save.disabled = false;
    }

    save.addEventListener("click", () => doSave());

    document.getElementById("download")!.addEventListener("click", () =>
    {
        const zip = new JSZip();
        const drawings = zip.folder("drawings");
        
        for (let drawing of project.drawings)
        {
            const name = drawing.name + ".png";
            const url = drawing.texture.canvas.toDataURL("image/png");
            const data = url.substring(22);

            drawings.file(name, data, {base64: true});
        }

        zip.generateAsync({type: "blob"})
           .then(function(content) 
        {
            FileSaver.saveAs(content, "drawings.zip");
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

    document.getElementById("download-data")!.addEventListener("click", () =>
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

        //postGist(json, url => console.log(url));

        const blob = new Blob([json], {type: "application/json"});
        FileSaver.saveAs(blob, "project.flicksy.json");
    });

    document.getElementById("export-playable")!.addEventListener("click", () =>
    {
        exportPlayable(project);
    });

    pixi.view.oncontextmenu = (e) => e.preventDefault();

    pixi.stage.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
    {
        drawingBoardsPanel.updateDragging(event);
        scenesPanel.updateDragging(event);
    });

    const resize = () =>
    {
        const container = document.getElementById("container")! as HTMLDivElement;

        const w = container.clientWidth;
        const h = container.clientHeight; 

        // this part resizes the canvas but keeps ratio the same    
        pixi.renderer.view.style.width = w + "px";    
        pixi.renderer.view.style.height = h + "px";    
        
        // this part adjusts the ratio:    
        pixi.renderer.resize(w,h);

        const scale = Math.floor(Math.min(w / 160, h / 100));

        pixi.stage.scale = new Pixi.Point(scale, scale);
        pixi.stage.position = new Pixi.Point(w / 2, h / 2);
    };

    pixi.stage.interactive = true;
    pixi.ticker.add(delta => resize());

    findProject().then(setProject).then(() =>
    {
        if (bundled)
        {
            setPlayback();
        }
        else
        {
            setEditor();
        }
    });

    utility.buttonClick("new-project", () =>
    {
        setProject(newProject());
    });
}

setup();
