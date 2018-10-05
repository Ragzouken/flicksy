import * as Pixi from 'pixi.js';

import { FlicksyProject } from '../data/FlicksyProject';

import DrawingBoardsPanel from './DrawingBoardsPanel';
import ScenesPanel from './ScenesPanel';
import ProjectsPanel from './ProjectsPanel';
import PublishPanel from './PublishPanel';

const resolution = [160, 120];

export default class FlicksyEditor
{
    public readonly pixi: Pixi.Application;
    public readonly projectsPanel: ProjectsPanel;
    public readonly publishPanel: PublishPanel;
    public readonly drawingBoardsPanel: DrawingBoardsPanel;
    public readonly scenesPanel: ScenesPanel;

    public project: FlicksyProject;

    public constructor(sidebarContainer: HTMLElement,
                       canvasContainer: HTMLElement)
    {
        const container = document.getElementById("container")! as HTMLDivElement;

        // transparent prevents flickering on silk browser
        this.pixi = new Pixi.Application(resolution[0], 
                                         resolution[1], 
                                         { transparent: true });
        canvasContainer.appendChild(this.pixi.view);
        this.pixi.start();
        // turn pixi interaction on
        this.pixi.stage.interactive = true;

        this.projectsPanel = new ProjectsPanel(this);
        this.publishPanel = new PublishPanel(this);
        this.drawingBoardsPanel = new DrawingBoardsPanel(this);
        this.scenesPanel = new ScenesPanel(this);
        this.scenesPanel.drawingsPanel = this.drawingBoardsPanel;

        const resize = () =>
        {
            const w = container.clientWidth;
            const h = container.clientHeight; 

            // this part resizes the canvas but keeps ratio the same    
            this.pixi.renderer.view.style.width = w + "px";    
            this.pixi.renderer.view.style.height = h + "px";    
            
            // this part adjusts the ratio:    
            this.pixi.renderer.resize(w,h);

            const [referenceWidth, referenceHeight] = resolution;
            const margin = 4;

            const scale = Math.min(w / (referenceWidth  + margin), 
                                   h / (referenceHeight + margin));
            //const scale = Math.floor(Math.min(w / referenceWidth, h / referenceHeight));

            this.pixi.stage.scale = new Pixi.Point(scale, scale);
            this.pixi.stage.position = new Pixi.Point(w / 2, h / 2);
        };

        this.pixi.ticker.add(resize);

        this.pixi.view.oncontextmenu = (e) => e.preventDefault();

        this.pixi.stage.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
        {
            this.drawingBoardsPanel.updateDragging(event);
            this.scenesPanel.updateDragging(event);
        });
    }

    public setProject(project: FlicksyProject): void
    {
        this.project = project;
        project.flicksyVersion = "alpha-1";

        this.drawingBoardsPanel.setDrawingBoard(project.drawingBoards[0]);
        this.drawingBoardsPanel.setBrushColor(1);
        this.scenesPanel.setScene(project.scenes[0]);

        this.refresh();
    }

    public refresh(): void
    {
        this.projectsPanel.refresh();
        this.publishPanel.refresh();
        this.drawingBoardsPanel.refresh();
        this.scenesPanel.refresh();
    }
}
