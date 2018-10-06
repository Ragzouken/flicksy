import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';

import { buttonClick } from "../tools/utility";
import { uint8ToBase64 } from "../tools/base64";

import FlicksyEditor from "./FlicksyEditor";
import { FlicksyProject } from '../data/FlicksyProject';

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
