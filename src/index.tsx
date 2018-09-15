import './index.css';

import * as localForage from 'localforage';
import * as Pixi from 'pixi.js';

import { DrawingBoard } from './DrawingBoard';
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
    base.plot((x, y) => rgb2num(255, 255, 255, 32));
    base.update()

    board.PinDrawing(drawing, position);

    return drawing;
}

let stage: Pixi.Container;
let board = new DrawingBoard();

function setup()
{
    doPalette();
    doBrushes();
    setupMenu();

    stage = pixi.stage;
    stage.scale = new Pixi.Point(8, 8);

    const d = addDrawing(32, 32);

    localForage.getItem("test").then(data => {
      if (data instanceof Uint8ClampedArray)
      {
        d.texture.data.data.set(data);
        d.texture.context.putImageData(d.texture.data, 0, 0);
        d.texture.update();
      }
    });

    document.getElementById("save")!.addEventListener("click", () =>
    {
      localForage.setItem("test", d.texture.context.getImageData(0, 0, 32, 32).data);
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
    
            const drawing = createBlankPinnedDrawing(board, width, height, position);
    
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
        });
    }

    function addDrawing(width: number, height: number)
    {
      const base = new MTexture(width, height);
      const tex = new Pixi.Texture(base.base);
      const sprite = new Pixi.Sprite(tex);

      const drawing = new Drawing(base, sprite);

      stage.addChild(sprite);

      sprite.position = new Pixi.Point(randomInt(0, 96), randomInt(0, 96));

      base.plot((x, y) => rgb2num(0, Math.random() * 128, 0));
      base.update()

      sprite.interactive = true;
      sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
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

      return drawing;
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
      if (draggedDrawing == null) { return; }
      
      if (dragType === "draw")
      {
        const base = draggedDrawing.texture;
        const m = event.data.getLocalPosition(draggedDrawing.sprite);

        /*
        base.line(Math.floor(prevDraw.x), Math.floor(prevDraw.y), 
                  Math.floor(m.x),        Math.floor(m.y), 
                  color);
        */
        
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
