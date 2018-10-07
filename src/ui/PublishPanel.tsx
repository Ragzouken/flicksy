import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { exportPlayable, projectToJson } from '../tools/saving';
import { buttonClick } from "../tools/utility";
import FlicksyEditor from "./FlicksyEditor";
import Panel from './Panel';

export default class PublishPanel implements Panel
{
    private readonly sidebar: HTMLElement;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sidebar = document.getElementById("publish")! as HTMLDivElement;

        buttonClick("export-playable", () => exportPlayable(editor.project));
        buttonClick("download-data", () => 
        {
            const json = projectToJson(editor.project);
            const blob = new Blob([json], {type: "application/json"});
            FileSaver.saveAs(blob, "project.flicksy.json");
        });
        buttonClick("download", () =>
        {
            const zip = new JSZip();
            const drawings = zip.folder("drawings");
            
            for (const drawing of editor.project.drawings)
            {
                const name = drawing.name + ".png";
                const url = drawing.texture.canvas.toDataURL("image/png");
                const data = url.substring(22);

                drawings.file(name, data, {base64: true});
            }

            zip.generateAsync({type: "blob"})
            .then(content => FileSaver.saveAs(content, "drawings.zip"));
        });
    }

    public refresh(): void
    {
        return;
    }

    public show(): void
    {
        this.sidebar.hidden = false;
    }

    public hide(): void
    {
        this.sidebar.hidden = true;
    }
}
