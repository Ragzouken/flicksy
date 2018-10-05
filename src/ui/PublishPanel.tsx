import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';

import { buttonClick } from "../utility";
import { uint8ToBase64 } from "../Base64";

import FlicksyEditor from "./FlicksyEditor";
import { exportPlayable } from "..";

export default class PublishPanel
{
    private readonly editor: FlicksyEditor;

    private readonly sidebar: HTMLElement;

    public constructor(editor: FlicksyEditor)
    {
        this.editor = editor;

        this.sidebar = document.getElementById("publish")! as HTMLDivElement;

        buttonClick("export-playable", () => exportPlayable(editor.project));
        buttonClick("download-data", () =>
        {
            const json = JSON.stringify(editor.project.toData(), (key, value) =>
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

            const blob = new Blob([json], {type: "application/json"});
            FileSaver.saveAs(blob, "project.flicksy.json");
        });
        buttonClick("download", () =>
        {
            const zip = new JSZip();
            const drawings = zip.folder("drawings");
            
            for (let drawing of editor.project.drawings)
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
    }

    public refresh(): void
    {

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
