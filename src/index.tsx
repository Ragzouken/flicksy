import './index.css';

import * as utility from './tools/utility';
import FlicksyEditor from './ui/FlicksyEditor';
import { jsonToProject, findProject } from './tools/saving';

async function start()
{
    const editor = new FlicksyEditor(utility.getElement("sidebar"), 
                                     utility.getElement("root"),
                                     [160, 100]);

    // play embeded game or open editor
    const embed = document.getElementById("flicksy-data");

    if (embed)
    {
        editor.setProject(jsonToProject(embed.innerHTML));
        editor.enterPlayback(false);
    }
    else
    {
        const project = await findProject();
        editor.setProject(project);
        editor.enterEditor();
    }
}

start();
