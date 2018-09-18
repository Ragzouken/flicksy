import './index.css';

import * as localForage from 'localforage';
import * as Pixi from 'pixi.js';
import * as JSZip from 'jszip'
import * as FileSaver from 'file-saver'

import DrawingBoardsApp from './DrawingBoardsApp'
import { DrawingBoard, PinnedDrawing } from './DrawingBoard';
import { Drawing } from './Drawing';
import { MTexture } from './MTexture';

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

function floor(point: Pixi.Point)
{
  return new Pixi.Point(Math.floor(point.x), Math.floor(point.y));
}

let brushColor = rgb2num(255, 0, 255);
let brushSize = 1;
let brush = new MTexture(3, 3);

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
            erasing = (c == 0);
            brushColor = c;
            makeCircleBrush(brushSize, brushColor);
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
        makeCircleBrush(brushSize, brushColor);
        console.log(brushSize);
    })
  }
}

let erasing = false;

function makeCircleBrush(circumference: number, color: number)
{
    brush = new MTexture(circumference, circumference);
    brush.circleTest(color == 0 ? white : color);
}

function createBlankDrawingBoard(): DrawingBoard
{
    let board = new DrawingBoard();
    board.name = "default board";

    return board;
}

function createBlankPinnedDrawing(board: DrawingBoard, 
                                  width: number, 
                                  height: number,
                                  position: Pixi.Point): Drawing
{
    const base = new MTexture(width, height);
    const sprite = new Pixi.Sprite(base.texture);

    // TODO: move this (sprite shouldn't be part of drawings)
    sprite.position = position;

    const drawing = new Drawing(base, sprite);
    base.fill(0);
    base.update()

    const border = new Pixi.Graphics();
    border.lineStyle(.125, 0xFFFFFF);
    border.drawRect(-.5, -.5, width + 1, height + 1);
    border.alpha = 0.25;
    sprite.addChild(border);

    const highlight = new Pixi.Graphics();
    highlight.lineStyle(.5, 0xFFFFFF);
    highlight.drawRect(-.5, -.5, width + 1, height + 1);
    highlight.alpha = 0.5;
    sprite.addChild(highlight);
    drawing.highlight = highlight;
    highlight.visible = false;

    drawing.name = `drawing ${board.pinnedDrawings.length}`;
    board.PinDrawing(drawing, position);

    return drawing;
}

let stage: Pixi.Container;
let activeBoard = new DrawingBoard();

interface PinData
{
    "position": number[];
    
    // actually drawing
    "name": string;
    "size": number[];
    "data": Uint8ClampedArray;
}

interface BoardData
{
    "guid": string;
    "name": string;
    "pins": PinData[];
}

function BoardToDataObject(board: DrawingBoard): BoardData
{
    const object: BoardData = {
        "guid": "",
        "name": board.name,
        "pins": [],
    };

    for (let pin of board.pinnedDrawings)
    {
        const texture = pin.drawing.texture;
        const data = texture.context.getImageData(0, 0, texture.data.width, texture.data.height).data;

        const pin_ = {
            "name": pin.drawing.name,
            "position": [pin.drawing.sprite.position.x, pin.drawing.sprite.position.y],
            "size": [texture.data.width, texture.data.height],
            "data": data,
        };

        object.pins.push(pin_);
    }

    return object;
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
        const index = activeBoard.pinnedDrawings.findIndex(pin => pin.drawing == drawing);
        const pin = activeBoard.pinnedDrawings[index];
        
        stage.removeChild(pin.drawing.sprite);
        activeBoard.pinnedDrawings.splice(index, 1);

        refreshDropdown();
    }
}

function getSelectedDrawing(): Drawing | undefined
{
    const dropdown = document.getElementById("select-drawing")! as HTMLSelectElement;

    if (dropdown.selectedIndex < 0) return undefined;

    return activeBoard.pinnedDrawings[dropdown.selectedIndex].drawing;
}

function refreshName()
{
    const drawing = getSelectedDrawing();
    const name = document.getElementById("drawing-name")! as HTMLInputElement;

    for (let pin of activeBoard.pinnedDrawings)
    {
        pin.drawing.highlight.visible = false;
    }

    if (drawing)
    {
        name.value = drawing.name;
        
        drawing.highlight.visible = true;
    }
}

function refreshDropdown()
{
    const dropdown = document.getElementById("select-drawing")! as HTMLSelectElement;

    while (dropdown.lastChild)
    {
        dropdown.removeChild(dropdown.lastChild);
    }

    for (let pin of activeBoard.pinnedDrawings)
    {
        const option = document.createElement("option");
        option.value = activeBoard.pinnedDrawings.indexOf(pin).toString();
        option.text = pin.drawing.name;

        dropdown.appendChild(option);
    }

    refreshName();
}

function setup()
{
    doPalette();
    doBrushes();
    setupMenu();

    stage = pixi.stage;
    stage.scale = new Pixi.Point(8, 8);

    const app = new DrawingBoardsApp(pixi);

    const dropdown = document.getElementById("select-drawing")! as HTMLSelectElement;
    dropdown.addEventListener("change", () =>
    {
        refreshName();
    });

    (document.getElementById("rename-drawing-button")! as HTMLButtonElement).addEventListener("click", rename);
    (document.getElementById("delete-drawing-button")! as HTMLButtonElement).addEventListener("click", delete_);

    function loadBoard(data: BoardData)
    {
        const board = new DrawingBoard();
        board.guid = data.guid;
        board.name = data.name;

        for (let pindata of data.pins)
        {
            const drawing = createBlankPinnedDrawing(board, 
                                                     pindata.size[0], 
                                                     pindata.size[1],
                                                     new Pixi.Point(pindata.position[0], pindata.position[1]));

            if (pindata.name) drawing.name = pindata.name;
            drawing.texture.data.data.set(pindata.data);
            drawing.texture.context.putImageData(drawing.texture.data, 0, 0);
            drawing.texture.update();

            addDrawing(drawing);
        }

        activeBoard = board;

        refreshDropdown();
    }

    localForage.getItem<BoardData>("test2").then(board => 
    {
        if (board)
        {
            loadBoard(board);
        }
        else
        {
            activeBoard = createBlankDrawingBoard();
        }

        /*
      if (data instanceof Uint8ClampedArray)
      {
        d.texture.data.data.set(data);
        d.texture.context.putImageData(d.texture.data, 0, 0);
        d.texture.update();
      }*/
    });

    document.getElementById("save")!.addEventListener("click", () =>
    {
        localForage.setItem("test2", BoardToDataObject(activeBoard));
    });

    function padLeft(text:string, padChar:string, size:number): string {
        return (String(padChar).repeat(size) + text).substr( (size * -1), size) ;
    }

    document.getElementById("download")!.addEventListener("click", () =>
    {
        const zip = new JSZip();
        const drawings = zip.folder("drawings");
        let i = 0;

        for (let pin of activeBoard.pinnedDrawings)
        {
            const name = pin.drawing.name + ".png";
            const url = pin.drawing.texture.canvas.toDataURL("image/png");
            const data = url.substring(22);

            drawings.file(name, data, {base64: true});

            i += 1;
        }

        zip.generateAsync({type: "blob"})
           .then(function(content) 
        {
            FileSaver.saveAs(content, "drawings.zip");
        });
    });

    let dragType: "draw" | "move" | null;
    let dragBase: Pixi.Point;
    let draggedDrawing: Drawing | null;
    let prevDraw = new Pixi.Point(0, 0);

    function startDrawing(drawing: Drawing, event: Pixi.interaction.InteractionEvent)
    {
      if (draggedDrawing != null)
      {
        stopDragging();
      }

      draggedDrawing = drawing;
      dragType = "draw";
      prevDraw = event.data.getLocalPosition(drawing.sprite);
    }

    function stopDragging()
    {
      draggedDrawing = null;
    }

    function startDragging(drawing: Drawing, event: Pixi.interaction.InteractionEvent)
    {
      if (draggedDrawing != null)
      {
        stopDragging();
      }

      draggedDrawing = drawing;
      dragType = "move";
      prevDraw = event.data.getLocalPosition(drawing.sprite);
      dragBase = sub(drawing.sprite.position, event.data.getLocalPosition(stage));
    }

    function addPinnedDrawing(drawing: PinnedDrawing)
    {

    }

    function addDrawing(drawing: Drawing)
    {
        stage.addChild(drawing.sprite);
    
        drawing.sprite.interactive = true;
        drawing.sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
        {
            if (event.data.button === 2)
            {
                startDragging(drawing, event);
                event.stopPropagation();
            }
            else
            {
                startDrawing(drawing, event);
                event.stopPropagation();
            }
        });

        refreshDropdown();
    }

    function setupMenu()
    {
        const createUI = document.getElementById("create-drawing-button")!;
        const widthUI = document.getElementById("create-drawing-width")! as HTMLSelectElement;
        const heightUI = document.getElementById("create-drawing-height")! as HTMLSelectElement;
    
        createUI.addEventListener("click", () =>
        {
            const position = new Pixi.Point(randomInt(8, 96), randomInt(8, 96));
            const width = +widthUI.options[widthUI.selectedIndex].value;
            const height = +heightUI.options[heightUI.selectedIndex].value;
    
            const drawing = createBlankPinnedDrawing(activeBoard, width, height, position);
    
            addDrawing(drawing);
        });
    }

    function add(a: Pixi.Point | Pixi.ObservablePoint, b: Pixi.Point | Pixi.ObservablePoint)
    {
      return new Pixi.Point(a.x + b.x, a.y + b.y);
    }

    function sub(a: Pixi.Point | Pixi.ObservablePoint, b: Pixi.Point | Pixi.ObservablePoint)
    {
      return new Pixi.Point(a.x - b.x, a.y - b.y);
    }

    /*
    this.pixi.stage.on("pointerdown", (event: Pixi.interaction.InteractionEvent) => 
    {
      dragType = (event.data.button == 0) ? "draw" : "move";
      prevDrag = event.data.getLocalPosition(sprite);
      
      dragBase = sub(sprite.position, event.data.getLocalPosition(this.pixi.stage));

      const x = Math.floor(prevDrag.x);
      const y = Math.floor(prevDrag.y);

      if (base.getPixel(x, y) == green)
      {
        color = black;
      }
      else
      {
        color = green;
      }

      base.line(x, y, x, y, color);
      base.update();

      event.stopPropagation();
    });
    */

    pixi.view.oncontextmenu = (e) => 
    {
      e.preventDefault();
    };

    pixi.stage.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
    {
        app.updateDragging(event);

      if (draggedDrawing == null) { return; }
      
      if (dragType === "draw")
      {
        const base = draggedDrawing.texture;
        const m = event.data.getLocalPosition(draggedDrawing.sprite);
        
        if (erasing)
        {
            base.context.globalCompositeOperation = "destination-out";
        }

        base.sweepTest(Math.floor(prevDraw.x), Math.floor(prevDraw.y), 
                       Math.floor(m.x),        Math.floor(m.y), 
                       brush);
        
        base.context.globalCompositeOperation = "source-over";
        base.update();

        prevDraw = m;
      }
      else if (draggedDrawing != null)
      {
        draggedDrawing.sprite.position = floor(add(dragBase, event.data.getLocalPosition(pixi.stage)));
      }
    });

    document.onpointerup = () => 
    {
      stopDragging();
    }

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
