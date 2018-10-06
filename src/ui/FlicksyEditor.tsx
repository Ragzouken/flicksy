import * as Pixi from 'pixi.js';
import * as utility from '../tools/utility';

import { FlicksyProject } from '../data/FlicksyProject';

import DrawingBoardsPanel from './DrawingBoardsPanel';
import ScenesPanel from './ScenesPanel';
import ProjectsPanel from './ProjectsPanel';
import PublishPanel from './PublishPanel';
import { saveProject } from '../tools/saving';

const resolution = [160, 120];

export default class FlicksyEditor
{
    public readonly pixi: Pixi.Application;
    public readonly projectsPanel: ProjectsPanel;
    public readonly publishPanel: PublishPanel;
    public readonly drawingBoardsPanel: DrawingBoardsPanel;
    public readonly scenesPanel: ScenesPanel;

    public project: FlicksyProject;

    private readonly sidebarContainer: HTMLElement;
    private readonly returnToEditorButton: HTMLButtonElement;

    private readonly pixiCanvasContainer: HTMLElement;
    private readonly saveButton: HTMLButtonElement;

    public constructor(sidebarContainer: HTMLElement,
                       canvasContainer: HTMLElement)
    {
        this.pixiCanvasContainer = document.getElementById("container")! as HTMLDivElement;

        // transparent prevents flickering on silk browser
        this.pixi = new Pixi.Application(resolution[0], 
                                         resolution[1], 
                                         { transparent: true });
        canvasContainer.appendChild(this.pixi.view);
        this.pixi.start();

        // create all the other ui
        this.projectsPanel = new ProjectsPanel(this);
        this.publishPanel = new PublishPanel(this);
        this.drawingBoardsPanel = new DrawingBoardsPanel(this);
        this.scenesPanel = new ScenesPanel(this);

        // editor vs playback
        this.sidebarContainer = utility.getElement("sidebar");
        this.returnToEditorButton = utility.getElement("editor-button");

        // save button
        this.saveButton = document.getElementById("save")! as HTMLButtonElement;
        this.saveButton.addEventListener("click", () => this.saveProject());

        // constantly ensure canvas size is correct
        this.pixi.ticker.add(() => this.resizePixiCanvas());
        // block the right click menu on the canvas
        this.pixi.view.oncontextmenu = (e) => e.preventDefault();

        // pass pointer move events to the various panels
        this.pixi.stage.interactive = true;
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

    public setActivePanel(panel: {show: () => void}): void
    {
        this.projectsPanel.hide();
        this.drawingBoardsPanel.hide();
        this.scenesPanel.hide();
        this.publishPanel.hide();

        panel.show();
    }

    public enterPlayback(escapable: boolean): void
    {
        this.returnToEditorButton.hidden = !escapable;
        this.sidebarContainer.hidden = true;

        this.setActivePanel(this.scenesPanel);

        this.scenesPanel.setScene(this.project.scenes[0]);
        this.scenesPanel.setPlayTestMode(true);
    }

    public enterEditor(): void
    {
        this.returnToEditorButton.hidden = true;
        this.sidebarContainer.hidden = false;
    }

    private async saveProject(): Promise<void>
    {
        // prevent saving while already saving
        this.saveButton.disabled = true;
        this.saveButton.textContent = "saving..."

        // guaranteed saving takes enough time to see that it happened
        const delay = utility.delay(500);
        await saveProject(this.project);
        await delay;

        // show saved confirmation briefly
        this.saveButton.textContent = "saved!";
        await utility.delay(200);

        // restore save button to natural state
        this.saveButton.textContent = "save";
        this.saveButton.disabled = false;
    }

    private resizePixiCanvas(): void
    {
        const w = this.pixiCanvasContainer.clientWidth;
        const h = this.pixiCanvasContainer.clientHeight; 

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
    }
}
