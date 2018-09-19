import './index.css';

import * as localForage from 'localforage';
import * as Pixi from 'pixi.js';
import * as JSZip from 'jszip'
import * as FileSaver from 'file-saver'
import * as uuid from 'uuid/v4'

import DrawingBoardsApp from './DrawingBoardsApp'
import { DrawingBoard, DrawingBoardData } from './DrawingBoard';
import { Drawing } from './Drawing';
import { MTexture } from './MTexture';
import { FlicksyProject, FlicksyProjectData } from './FlicksyProject';

const pixi = new Pixi.Application();
document.getElementById("root")!.appendChild(pixi.view);
pixi.start();

function rgb2num(r: number, g: number, b: number, a: number = 255)
{
  return ((a << 24) | (b << 16) | (g << 8) | (r)) >>> 0;
}

function randomInt(min: number, max: number){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let brushColor = rgb2num(255, 0, 255);
let brushSize = 1;

const white = rgb2num(255, 255, 255, 255);

function doPalette()
{
    const palette = document.getElementById("palette")!;

    for (let i = 0; i < palette.children.length; ++i)
    {
        const cell = palette.children[i];
        const button = cell.children[0];
        let r = randomInt(0, 255);
        let g = randomInt(0, 255);
        let b = randomInt(0, 255);
        let c = rgb2num(r, g, b);

        if (i == 0)
        {
            r = 0;
            g = 0;
            b = 0;
            c = 0;
        }

        button.setAttribute("style", `background-color: rgb(${r},${g},${b});`);
        button.addEventListener("click", () => 
        {
            app.erasing = (c == 0);
            brushColor = c;
            app.brush = makeCircleBrush(brushSize, brushColor);
        })
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
        app.brush = makeCircleBrush(brushSize, brushColor);
        console.log(brushSize);
    })
  }
}

function makeCircleBrush(circumference: number, color: number): MTexture
{
    const brush = new MTexture(circumference, circumference);
    brush.circleTest(color == 0 ? white : color);

    return brush;
}

function rename()
{
    const drawing = getSelectedDrawing();
    const name = document.getElementById("drawing-name")! as HTMLInputElement;

    if (drawing)
    {
        drawing.name = name.value;

        refreshDropdown();
    }
}

function delete_()
{
    const drawing = getSelectedDrawing();

    if (drawing)
    {
        const index = app.activeBoard.pinnedDrawings.findIndex(pin => pin.drawing == drawing);
        app.activeBoard.pinnedDrawings.splice(index, 1);
        refreshDropdown();
    }
}

function getSelectedDrawing(): Drawing | undefined
{
    const dropdown = document.getElementById("select-drawing")! as HTMLSelectElement;

    if (dropdown.selectedIndex < 0) return undefined;

    return app.activeBoard.pinnedDrawings[dropdown.selectedIndex].drawing;
}

function refreshName()
{
    const drawing = getSelectedDrawing();
    const name = document.getElementById("drawing-name")! as HTMLInputElement;

    if (drawing)
    {
        name.value = drawing.name;
    }
}

function refreshDropdown()
{
    const dropdown = document.getElementById("select-drawing")! as HTMLSelectElement;

    if (app.selected)
    {
        dropdown.selectedIndex = app.activeBoard.pinnedDrawings.indexOf(app.selected);
    }

    refreshName();
    app.refresh();
}

let project: FlicksyProject;
let app: DrawingBoardsApp;

function setup()
{
    doPalette();
    doBrushes();
    setupMenu();

    pixi.stage.scale = new Pixi.Point(8, 8);

    app = new DrawingBoardsApp(pixi);

    const dropdown = document.getElementById("select-drawing")! as HTMLSelectElement;
    dropdown.addEventListener("change", () =>
    {
        refreshName();
    });

    (document.getElementById("rename-drawing-button")! as HTMLButtonElement).addEventListener("click", rename);
    (document.getElementById("delete-drawing-button")! as HTMLButtonElement).addEventListener("click", delete_);

    localForage.getItem<FlicksyProjectData>("v1-test").then(projectData => 
    {
        project = new FlicksyProject();
        project.name = "unnamed project";
        project.uuid = uuid();
        
        if (projectData)
        {
            project.fromData(projectData);
        }

        app.setDrawingBoard(project.drawingBoards[0]);

        refreshDropdown();
    });

    document.getElementById("save")!.addEventListener("click", () =>
    {
        localForage.setItem("test4", app.activeBoard.toData());
        localForage.setItem("v1-test", project.toData());
    });

    document.getElementById("download")!.addEventListener("click", () =>
    {
        const zip = new JSZip();
        const drawings = zip.folder("drawings");
        
        for (let pin of app.activeBoard.pinnedDrawings)
        {
            const name = pin.drawing.name + ".png";
            const url = pin.drawing.texture.canvas.toDataURL("image/png");
            const data = url.substring(22);

            drawings.file(name, data, {base64: true});
        }

        zip.generateAsync({type: "blob"})
           .then(function(content) 
        {
            FileSaver.saveAs(content, "drawings.zip");
        });
    });

    document.getElementById("download-data")!.addEventListener("click", () =>
    {
        const json = JSON.stringify(project.toData());
        const blob = new Blob([json], {type: "application/json"});

        FileSaver.saveAs(blob, "project.json");
    });

    function setupMenu()
    {
        const createUI = document.getElementById("create-drawing-button")!;
        const widthUI = document.getElementById("create-drawing-width")! as HTMLSelectElement;
        const heightUI = document.getElementById("create-drawing-height")! as HTMLSelectElement;
    
        createUI.addEventListener("click", () =>
        {
            const position = new Pixi.Point(randomInt(48, 128), randomInt(2, 96));
            const width = +widthUI.options[widthUI.selectedIndex].value;
            const height = +heightUI.options[heightUI.selectedIndex].value;

            const drawing = project.createDrawing(width, height);
            drawing.name = `drawing ${app.activeBoard.pinnedDrawings.length}`;
            app.activeBoard.PinDrawing(drawing, position);

            refreshDropdown();
        });
    }

    pixi.view.oncontextmenu = (e) => 
    {
      e.preventDefault();
    };

    pixi.stage.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
    {
        app.updateDragging(event);
    });

    const resize = () =>
    {
      const w = document.documentElement.clientWidth;    
      const h = document.documentElement.clientHeight;    
      // this part resizes the canvas but keeps ratio the same    
      pixi.renderer.view.style.width = w + "px";    
      pixi.renderer.view.style.height = h + "px";    
      // this part adjusts the ratio:    
      pixi.renderer.resize(w,h);
    };

    pixi.stage.interactive = true;
    pixi.ticker.add(delta => 
    {
        resize();
    });
}

setup();
