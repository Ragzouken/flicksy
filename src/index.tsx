import './index.css';

import * as localForage from 'localforage';
import * as Pixi from 'pixi.js';
import * as JSZip from 'jszip'
import * as FileSaver from 'file-saver'
import * as uuid from 'uuid/v4'

import { base64ToUint8, uint8ToBase64 } from './Base64'

import DrawingBoardsApp from './DrawingBoardsApp'
import { DrawingBoard } from './DrawingBoard';
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

let brushColor = 0xFF00FF;
let brushSize = 1;

const white = 0xFFFFFF;

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

let project: FlicksyProject;
let app: DrawingBoardsApp;

function setup()
{
    doPalette();
    doBrushes();
    setupMenu();

    pixi.stage.scale = new Pixi.Point(8, 8);

    app = new DrawingBoardsApp(pixi);

    app.brush = makeCircleBrush(1, 0xFFFFFF);

    function loadProject(data: FlicksyProjectData)
    {
        project = new FlicksyProject();
        project.fromData(data);

        app.setDrawingBoard(project.drawingBoards[0]);
        app.refresh();
    }

    localForage.getItem<FlicksyProjectData>("v1-test").then(projectData => 
    {        
        if (projectData)
        {
            loadProject(projectData);
        }
        else
        {
            project = new FlicksyProject();
            project.name = "unnamed project";
            project.uuid = uuid();
            
            project.drawingBoards.push(new DrawingBoard());
            app.setDrawingBoard(project.drawingBoards[0]);
            app.refresh();
        }
    });

    document.getElementById("save")!.addEventListener("click", () =>
    {
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

                loadProject(data);
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

            app.refresh();
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
