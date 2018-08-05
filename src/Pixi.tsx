import * as React from 'react';
import * as Pixi from 'pixi.js';
import { MTexture } from "./MTexture";
import { Drawing } from "./Drawing";

interface IMainProps {}
interface IMainState {}

export class PixiComponent extends React.Component<IMainProps, IMainState> 
{
  private pixi: Pixi.Application;
  private container: HTMLDivElement;

  constructor(props: IMainProps) 
  {
    super(props);
  }

  private setup(): void
  {
    this.pixi = new Pixi.Application(256, 256);
    this.container.appendChild(this.pixi.view);
    this.pixi.start();

    let stage = this.pixi.stage;
    stage.scale = new Pixi.Point(8, 8);

    addDrawing(32, 32);
    addDrawing(8, 8);
    addDrawing(16, 16);

    //let orig: Pixi.Point?;
    let dragType: "draw" | "move" | null;
    let dragBase: Pixi.Point;
    let draggedDrawing: Drawing | null;
    let prevDraw = new Pixi.Point(0, 0);
    let color = rgb2num(255, 0, 255);

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

    function addDrawing(width: number, height: number)
    {
      const base = new MTexture(width, height);
      const tex = new Pixi.Texture(base.base);
      const sprite = new Pixi.Sprite(tex);

      const poo = "";

      const drawing = new Drawing(base, sprite);

      stage.addChild(sprite);

      base.plot((x, y) => rgb2num(0, Math.random() * 128, 0));
      base.update()

      sprite.interactive = true;
      //sprite.hitArea = new Pixi.Rectangle(0, 0, width, height);
      sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
      {
        if (event.data.button == 2)
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

    this.pixi.view.oncontextmenu = function (e) 
    {
      e.preventDefault();
    };

    this.pixi.stage.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
    {
      if (draggedDrawing == null) return;
      
      if (dragType == "draw")
      {
        const base = draggedDrawing.texture;
        const m = event.data.getLocalPosition(draggedDrawing.sprite);

        base.line(Math.floor(prevDraw.x), Math.floor(prevDraw.y), 
                  Math.floor(m.x),        Math.floor(m.y), 
                  color);
        base.update();

        prevDraw = m;
      }
      else if (draggedDrawing != null)
      {
        draggedDrawing.sprite.position = add(dragBase, event.data.getLocalPosition(this.pixi.stage));
      }
    });

    document.onpointerup = () => 
    {
      stopDragging();
    }

    function rgb2num(r: number, g: number, b: number)
    {
      return ((0xFF << 24) | (r << 16) | (g << 8) | (b)) >>> 0;
    }

    const resize = () =>
    {
      const w = document.documentElement.clientWidth;    
      const h = document.documentElement.clientHeight;    
      //this part resizes the canvas but keeps ratio the same    
      this.pixi.renderer.view.style.width = w + "px";    
      this.pixi.renderer.view.style.height = h + "px";    
      //this part adjusts the ratio:    
      this.pixi.renderer.resize(w,h);

      //const min = Math.min(w, h);
      //const scale = min / 8;
      //sprite.scale = new Pixi.Point(scale, scale);
    };

    this.pixi.stage.interactive = true;
    this.pixi.ticker.add(delta => 
    {
      resize();
    });
  }

  /**
   * After mounting, add the Pixi Renderer to the div and start the Application.
   */
  public componentDidMount() 
  {
    this.setup();
  }
  
  /**
   * Stop the Application when unmounting.
   */
  public componentWillUnmount() 
  {
    this.pixi.stop();
  }
  
  /**
   * Simply render the div that will contain the Pixi Renderer.
   */
  public render() 
  {
    const component = this;

    return <div ref={(div) => {component.container = div!}} />;
  }
}
